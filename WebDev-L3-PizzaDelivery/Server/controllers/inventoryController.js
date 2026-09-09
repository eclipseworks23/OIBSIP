const Inventory = require("../models/inventory");

// Public: get all active inventory items, grouped by category
// Used by the customer pizza builder
async function getActiveInventory(req, res) {
  try {
    const items = await Inventory.find({ active: true }).select(
      "name category quantity"
    );

    const grouped = {
      base: items.filter((item) => item.category === "base"),
      sauce: items.filter((item) => item.category === "sauce"),
      cheese: items.filter((item) => item.category === "cheese"),
      vegetable: items.filter((item) => item.category === "vegetable"),
    };

    res.status(200).json(grouped);
  } catch (error) {
    console.error("Get active inventory error:", error.message);
    res.status(500).json({ message: "Server error fetching inventory" });
  }
}

// Admin only: get full inventory list, including inactive items and thresholds
async function getAllInventory(req, res) {
  try {
    const items = await Inventory.find().sort({ category: 1, name: 1 });
    res.status(200).json(items);
  } catch (error) {
    console.error("Get all inventory error:", error.message);
    res.status(500).json({ message: "Server error fetching inventory" });
  }
}

// Admin only: manually update stock quantity and/or threshold for one item
async function updateInventoryItem(req, res) {
  try {
    const { id } = req.params;
    const { quantity, lowStockThreshold, active } = req.body;

    const item = await Inventory.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Inventory item not found" });
    }

    if (quantity !== undefined) {
      if (quantity < 0) {
        return res.status(400).json({ message: "Quantity cannot be negative" });
      }
      item.quantity = quantity;
    }

    if (lowStockThreshold !== undefined) {
      item.lowStockThreshold = lowStockThreshold;
    }

    if (active !== undefined) {
      item.active = active;
    }

    await item.save();

    res.status(200).json({ message: "Inventory item updated", item });
  } catch (error) {
    console.error("Update inventory error:", error.message);
    res.status(500).json({ message: "Server error updating inventory" });
  }
}

module.exports = { getActiveInventory, getAllInventory, updateInventoryItem };