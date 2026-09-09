const Order = require("../models/Order");
const Inventory = require("../models/inventory");
const razorpayInstance = require("../utils/razorpay");
const crypto = require("crypto");

// Customer: create a pending order after selecting base, sauce, cheese, vegetables
async function createOrder(req, res) {
  try {
    const { baseId, sauceId, cheeseId, vegetableIds } = req.body;

    if (!baseId || !sauceId || !cheeseId) {
      return res.status(400).json({ message: "Base, sauce, and cheese are required" });
    }

    const vegIds = Array.isArray(vegetableIds) ? vegetableIds : [];

    // Fetch all selected ingredients in one go
    const allIds = [baseId, sauceId, cheeseId, ...vegIds];
    const items = await Inventory.find({ _id: { $in: allIds }, active: true });

    if (items.length !== allIds.length) {
      return res.status(400).json({ message: "One or more selected ingredients are unavailable" });
    }

    const base = items.find((i) => i._id.toString() === baseId);
    const sauce = items.find((i) => i._id.toString() === sauceId);
    const cheese = items.find((i) => i._id.toString() === cheeseId);
    const vegetables = items.filter((i) => vegIds.includes(i._id.toString()));

    if (base.category !== "base" || sauce.category !== "sauce" || cheese.category !== "cheese") {
      return res.status(400).json({ message: "Invalid ingredient categories selected" });
    }

    // Check stock availability for every selected item (1 unit each, per order)
    const outOfStock = items.filter((item) => item.quantity < 1);
    if (outOfStock.length > 0) {
      return res.status(400).json({
        message: `Out of stock: ${outOfStock.map((i) => i.name).join(", ")}`,
      });
    }

    // Calculate total price server-side — never trust a price from the frontend
    const totalPrice =
      base.price + sauce.price + cheese.price + vegetables.reduce((sum, v) => sum + v.price, 0);

    const order = await Order.create({
      user: req.user._id,
      base: base._id,
      sauce: sauce._id,
      cheese: cheese._id,
      vegetables: vegetables.map((v) => v._id),
      totalPrice,
      paymentStatus: "pending",
      orderStatus: "Order Received",
    });

    res.status(201).json({ message: "Order created", order });
  } catch (error) {
    console.error("Create order error:", error.message);
    res.status(500).json({ message: "Server error creating order" });
  }
}
// Customer: create a Razorpay order for an existing pending order
async function createPaymentOrder(req, res) {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order id is required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "This order has already been paid" });
    }

    // Razorpay expects the amount in the smallest currency unit (paise for INR)
    const amountInPaise = Math.round(order.totalPrice * 100);

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order._id.toString(),
    });

    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      message: "Razorpay order created",
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Create payment order error:", error.message);
    res.status(500).json({ message: "Server error creating payment order" });
  }
}
// Customer: verify Razorpay payment and confirm the order
async function verifyPayment(req, res) {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification details" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized for this order" });
    }

    // If this order was already marked paid and stock already decremented,
    // don't process it again — protects against duplicate/retry requests
    if (order.paymentStatus === "paid" && order.stockDecremented) {
      return res.status(200).json({ message: "Order already confirmed", order });
    }

    if (order.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: "Order mismatch" });
    }

    // Recreate the expected signature using our secret key, and compare
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      order.paymentStatus = "failed";
      await order.save();
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Signature is valid — payment is genuine. Now decrement stock exactly once.
    if (!order.stockDecremented) {
      const ingredientIds = [order.base, order.sauce, order.cheese, ...order.vegetables];

      await Inventory.updateMany(
        { _id: { $in: ingredientIds } },
        { $inc: { quantity: -1 } }
      );

      order.stockDecremented = true;
    }

    order.paymentStatus = "paid";
    order.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    res.status(200).json({ message: "Payment verified, order confirmed", order });
  } catch (error) {
    console.error("Verify payment error:", error.message);
    res.status(500).json({ message: "Server error verifying payment" });
  }
}
// Customer: get their own orders, most recent first
async function getMyOrders(req, res) {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("base sauce cheese vegetables", "name category price");

    res.status(200).json(orders);
  } catch (error) {
    console.error("Get my orders error:", error.message);
    res.status(500).json({ message: "Server error fetching orders" });
  }
}

// Admin only: get all orders, most recent first
async function getAllOrders(req, res) {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate("user", "name email")
      .populate("base sauce cheese vegetables", "name category price");

    res.status(200).json(orders);
  } catch (error) {
    console.error("Get all orders error:", error.message);
    res.status(500).json({ message: "Server error fetching orders" });
  }
}

// Admin only: update an order's status
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    const validStatuses = ["Order Received", "In Kitchen", "Sent to Delivery"];

    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: "Invalid order status" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ message: "Cannot update status of an unpaid order" });
    }

    order.orderStatus = orderStatus;
    await order.save();

    res.status(200).json({ message: "Order status updated", order });
  } catch (error) {
    console.error("Update order status error:", error.message);
    res.status(500).json({ message: "Server error updating order status" });
  }
}
  module.exports = { createOrder, createPaymentOrder, verifyPayment, getMyOrders, getAllOrders, updateOrderStatus };