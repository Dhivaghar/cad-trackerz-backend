require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -------------------
// MySQL Connection
// -------------------
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Dhiva@2005",  // <-- your DB password
  database: "cad_trackerz",
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Database connected!");
});

// -------------------
// OTP store (in-memory)
// -------------------
let otpStore = {};

// -------------------
// SIGNUP: Send OTP
// -------------------
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const otp = Math.floor(1000 + Math.random() * 9000);
    otpStore[email] = otp;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is: ${otp}`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("OTP Email sent:", info.response);
    return res.json({ message: "OTP sent successfully" });

  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ message: "Error sending OTP", error: err.message });
  }
});

// -------------------
// SIGNUP: Verify OTP & Save User
// -------------------
app.post("/verify-otp", async (req, res) => {
  try {
    const { fullName, email, salary, password, otp } = req.body;

    // Check OTP
    if (!otpStore[email]) return res.status(400).send({ message: "OTP expired or not sent" });
    if (otpStore[email].toString() !== otp.toString())
      return res.status(400).send({ message: "Invalid OTP" });

    // Check if email already exists
    const checkQuery = "SELECT * FROM users WHERE email = ?";
    db.query(checkQuery, [email], async (err, result) => {
      if (err) return res.status(500).send({ message: "DB Error", err });

      if (result.length > 0) {
        return res.status(400).send({ message: "Email already exists" });
      }

      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const insertQuery = "INSERT INTO users (full_name, email, salary, password) VALUES (?, ?, ?, ?)";
      db.query(insertQuery, [fullName, email, salary, hashedPassword], (err, result) => {
        if (err) return res.status(500).send({ message: "DB Error", err });

        // OTP used, remove from store
        delete otpStore[email];

        // SEND WELCOME EMAIL
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to Our App!",
          text: `Hi ${fullName},\n\nSignup successful! Welcome to our app.\n\nBest regards,\nYour App Team`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) console.log("Welcome Email Error:", err);
          else console.log("Welcome Email sent:", info.response);

          res.send({ message: "User registered successfully" });
        });
      });
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).send({ message: "Server error", error: err.message });
  }
});

// -------------------
// LOGIN: User Login
// -------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "All fields required" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (results.length === 0)
      return res.status(401).json({ message: "User not found" });

    const user = results[0];

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({ message: "Login successful", user: { id: user.id, name: user.full_name,salary:user.salary } });
  });
});

// -------------------
// Start server
// -------------------
app.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Server running on port 5000");
});
