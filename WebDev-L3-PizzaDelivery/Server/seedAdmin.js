require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function seedAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
      process.exit(1);
    }

    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      console.log("Admin already exists with this email. No changes made.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await User.create({
      name: "Admin",
      email: adminEmail,
      password: hashedPassword,
      role: "admin",
      isVerified: true,
    });

    console.log("Admin account created successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error.message);
    process.exit(1);
  }
}

seedAdmin();