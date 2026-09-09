const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ["base", "sauce", "cheese", "vegetable"],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      default: 20,
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLowStockAlertAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inventory", inventorySchema);