const express = require("express");
const {
  getActiveInventory,
  getAllInventory,
  updateInventoryItem,
} = require("../controllers/inventoryController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/active", getActiveInventory);
router.get("/", protect, adminOnly, getAllInventory);
router.put("/:id", protect, adminOnly, updateInventoryItem);

module.exports = router;