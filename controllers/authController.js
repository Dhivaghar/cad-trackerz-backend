const db = require("../db");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

let otpStore = {};

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(1000 + Math.random() * 9000);
  otpStore[email] = otp;

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  const { fullName, email, salary, password, otp } = req.body;

  if (!otpStore[email]) return res.status(400).json({ message: "OTP expired or not sent" });
  if (otpStore[email].toString() !== otp.toString())
    return res.status(400).json({ message: "Invalid OTP" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error", err });

    if (result.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    db.query(
      "INSERT INTO users (full_name, email, salary, password) VALUES (?, ?, ?, ?)",
      [fullName, email, salary, hashedPassword],
      async (err) => {
        if (err) return res.status(500).json({ message: "DB Error", err });

        delete otpStore[email];

        // send welcome email
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to Our App!",
          text: `Hi ${fullName},\n\nSignup successful! Welcome to our app.`,
        });

        res.json({ message: "User registered successfully" });
      }
    );
  });
};

exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "All fields required" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (results.length === 0)
      return res.status(401).json({ message: "User not found" });

    const user = results[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ message: "Invalid credentials" });

    res.json({ message: "Login successful", user: { id: user.id, name: user.full_name, salary: user.salary, email: user.email } });
  });
};
