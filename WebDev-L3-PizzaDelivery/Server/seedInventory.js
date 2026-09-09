require("dotenv").config();

const mongoose = require("mongoose");
const Inventory = require("./models/inventory");

const items = [
  // 5 bases
  { name: "Thin Crust", category: "base", price: 150, quantity: 100, lowStockThreshold: 20 },
  { name: "Classic Hand-Tossed", category: "base", price: 170, quantity: 100, lowStockThreshold: 20 },
  { name: "Cheese Burst", category: "base", price: 220, quantity: 100, lowStockThreshold: 20 },
  { name: "Whole Wheat", category: "base", price: 180, quantity: 100, lowStockThreshold: 20 },
  { name: "Gluten-Free", category: "base", price: 200, quantity: 100, lowStockThreshold: 20 },

  // 5 sauces
  { name: "Classic Tomato", category: "sauce", price: 20, quantity: 100, lowStockThreshold: 20 },
  { name: "BBQ", category: "sauce", price: 30, quantity: 100, lowStockThreshold: 20 },
  { name: "Pesto", category: "sauce", price: 40, quantity: 100, lowStockThreshold: 20 },
  { name: "White Garlic", category: "sauce", price: 35, quantity: 100, lowStockThreshold: 20 },
  { name: "Spicy Arrabbiata", category: "sauce", price: 30, quantity: 100, lowStockThreshold: 20 },

  // Cheese options
  { name: "Mozzarella", category: "cheese", price: 50, quantity: 100, lowStockThreshold: 20 },
  { name: "Cheddar", category: "cheese", price: 55, quantity: 100, lowStockThreshold: 20 },
  { name: "Vegan Cheese", category: "cheese", price: 70, quantity: 100, lowStockThreshold: 20 },

  // Vegetables (multi-select)
  { name: "Onion", category: "vegetable", price: 10, quantity: 100, lowStockThreshold: 20 },
  { name: "Capsicum", category: "vegetable", price: 10, quantity: 100, lowStockThreshold: 20 },
  { name: "Mushroom", category: "vegetable", price: 15, quantity: 100, lowStockThreshold: 20 },
  { name: "Tomato", category: "vegetable", price: 10, quantity: 100, lowStockThreshold: 20 },
  { name: "Sweet Corn", category: "vegetable", price: 15, quantity: 100, lowStockThreshold: 20 },
  { name: "Black Olives", category: "vegetable", price: 20, quantity: 100, lowStockThreshold: 20 },
  { name: "Jalapeno", category: "vegetable", price: 15, quantity: 100, lowStockThreshold: 20 },
];

async function seedInventory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const existingCount = await Inventory.countDocuments();

    if (existingCount > 0) {
      console.log(`Inventory already has ${existingCount} items. No changes made.`);
      process.exit(0);
    }

    await Inventory.insertMany(items);

    console.log(`Inventory seeded successfully with ${items.length} items.`);
    process.exit(0);
  } catch (error) {
    console.error("Error seeding inventory:", error.message);
    process.exit(1);
  }
}

seedInventory();