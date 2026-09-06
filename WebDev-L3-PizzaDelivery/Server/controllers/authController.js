const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Token = require("../models/Token");
const { createRawToken, hashToken } = require("../utils/generateToken");
const sendEmail = require("../utils/sendEmail");
const jwt = require("jsonwebtoken");

async function registerUser(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await Token.create({
      userId: newUser._id,
      tokenHash,
      type: "verify-email",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}&id=${newUser._id}`;

    await sendEmail({
      to: newUser.email,
      subject: "Verify your Pizza Delivery account",
      html: `<p>Hello ${newUser.name},</p>
             <p>Click below to verify your email:</p>
             <a href="${verifyUrl}">${verifyUrl}</a>
             <p>This link expires in 24 hours.</p>`,
    });

    res.status(201).json({
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error during registration" });
  }
}
async function verifyEmail(req, res) {
  try {
    const { token, id } = req.body;

    if (!token || !id) {
      return res.status(400).json({ message: "Invalid verification link" });
    }

    const tokenHash = hashToken(token);

    const tokenDoc = await Token.findOne({
      userId: id,
      tokenHash,
      type: "verify-email",
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid or already used verification link" });
    }

    if (tokenDoc.expiresAt < new Date()) {
      await Token.deleteOne({ _id: tokenDoc._id });
      return res.status(400).json({ message: "Verification link has expired" });
    }

    await User.findByIdAndUpdate(id, { isVerified: true });
    await Token.deleteOne({ _id: tokenDoc._id });

    res.status(200).json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    console.error("Verify email error:", error.message);
    res.status(500).json({ message: "Server error during verification" });
  }
}
async function loginUser(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error during login" });
  }
}
async function getMe(req, res) {
  res.status(200).json({ user: req.user });
}
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    // Always respond the same way, whether or not the email exists.
    // This prevents anyone from using this endpoint to check which emails are registered.
    if (!user) {
      return res.status(200).json({
        message: "If that email is registered, a reset link has been sent.",
      });
    }

    // Remove any old reset tokens for this user before creating a new one
    await Token.deleteMany({ userId: user._id, type: "reset-password" });

    const rawToken = createRawToken();
    const tokenHash = hashToken(rawToken);

    await Token.create({
      userId: user._id,
      tokenHash,
      type: "reset-password",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${rawToken}&id=${user._id}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your Pizza Delivery password",
      html: `<p>Hello ${user.name},</p>
             <p>Click below to reset your password:</p>
             <a href="${resetUrl}">${resetUrl}</a>
             <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
    });

    res.status(200).json({
      message: "If that email is registered, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Server error during password reset request" });
  }
}
async function resetPassword(req, res) {
  try {
    const { token, id, newPassword } = req.body;

    if (!token || !id || !newPassword) {
      return res.status(400).json({ message: "Token, id, and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const tokenHash = hashToken(token);

    const tokenDoc = await Token.findOne({
      userId: id,
      tokenHash,
      type: "reset-password",
    });

    if (!tokenDoc) {
      return res.status(400).json({ message: "Invalid or expired reset link" });
    }

    if (tokenDoc.expiresAt < new Date()) {
      await Token.deleteOne({ _id: tokenDoc._id });
      return res.status(400).json({ message: "Reset link has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await User.findByIdAndUpdate(id, { password: hashedPassword });
    await Token.deleteOne({ _id: tokenDoc._id });

    res.status(200).json({ message: "Password reset successful. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Server error during password reset" });
  }
}
module.exports = { registerUser, verifyEmail, loginUser, getMe, forgotPassword, resetPassword };