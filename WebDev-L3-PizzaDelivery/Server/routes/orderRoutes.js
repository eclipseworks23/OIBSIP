const express = require("express");
const { createOrder, createPaymentOrder, verifyPayment } = require("../controllers/orderController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, createOrder);
router.post("/create-payment", protect, createPaymentOrder);
router.post("/verify-payment", protect, verifyPayment);

module.exports = router;