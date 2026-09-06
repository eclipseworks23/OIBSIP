const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["verify-email", "reset-password"],
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("Token", tokenSchema);