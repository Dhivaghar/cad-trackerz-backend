const db = require("../db");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

let otpStore = {};

// Helper: Send Expo Push Notification
async function sendPushNotification(expoToken, title, body) {
  if (!expoToken) return;
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: expoToken,
        sound: "default",
        title,
        body,
      }),
    });
  } catch (err) {
    console.error("Error sending push notification:", err.message);
  }
}

// ✉️ Send OTP
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

// ✅ Verify OTP & Register User
exports.verifyOtp = async (req, res) => {
  const { fullName, email, salary, password, otp, expo_token } = req.body;

  if (!otpStore[email])
    return res.status(400).json({ message: "OTP expired or not sent" });
  if (otpStore[email].toString() !== otp.toString())
    return res.status(400).json({ message: "Invalid OTP" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "DB Error", err });

    if (result.length > 0)
      return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Insert new user
    db.query(
      "INSERT INTO users (full_name, email, salary, password, expo_token) VALUES (?, ?, ?, ?, ?)",
      [fullName, email, salary, hashedPassword, expo_token || null],
      async (err2, userResult) => {
        if (err2) return res.status(500).json({ message: "DB Error", err2 });

        const userId = userResult.insertId;

        // Step 2: Create initial salary cycle with user’s salary
        db.query(
          "INSERT INTO salary_cycles (user_id, salary) VALUES (?, ?)",
          [userId, salary],
          (err3, cycleResult) => {
            if (err3) console.error("Error creating initial salary cycle:", err3);
            else {
              const cycleId = cycleResult.insertId;
              db.query("UPDATE users SET current_cycle_id = ? WHERE id = ?", [
                cycleId,
                userId,
              ]);
            }
          }
        );

        delete otpStore[email];

        // Step 3: Send welcome email
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Welcome to Our App!",
          text: `Hi ${fullName},\n\nSignup successful! Welcome aboard.`,
        });

        // Step 4: Optional push notification
        if (expo_token) {
          await sendPushNotification(expo_token, "Welcome 🎉", "Signup successful! Enjoy using the app.");
        }

        res.json({ message: "User registered successfully" });
      }
    );
  });
};

// 🔐 Login User
exports.login = (req, res) => {
  const { email, password, expo_token } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "All fields required" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (results.length === 0)
      return res.status(401).json({ message: "User not found" });

    const user = results[0];
    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass) return res.status(401).json({ message: "Invalid credentials" });

    if (expo_token) {
      db.query("UPDATE users SET expo_token = ? WHERE id = ?", [expo_token, user.id]);
    }

    if (user.expo_token || expo_token) {
      await sendPushNotification(
        expo_token || user.expo_token,
        "Login Successful ✅",
        `Welcome back, ${user.full_name}!`
      );
    }

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        name: user.full_name,
        salary: user.salary,
        email: user.email,
      },
    });
  });
};

// 💰 Update Salary
exports.updateSalary = (req, res) => {
  const { user_id, salary } = req.body;
  if (!user_id || !salary)
    return res.status(400).json({ message: "Missing fields" });

  db.query("UPDATE users SET salary = ? WHERE id = ?", [salary, user_id], (err) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json({ message: "Salary updated" });
  });
};

// 🔄 Reload Salary Cycle
exports.reloadSalary = (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: "User ID required" });

  db.query("SELECT salary FROM users WHERE id = ?", [user_id], (err, result) => {
    if (err || result.length === 0)
      return res.status(500).json({ message: "Error fetching user salary" });

    const userSalary = result[0].salary;

    db.query("INSERT INTO salary_cycles (user_id, salary) VALUES (?, ?)", [user_id, userSalary], (err2, result2) => {
      if (err2) return res.status(500).json({ message: "Database error" });

      const newCycleId = result2.insertId;
      db.query("UPDATE users SET current_cycle_id = ? WHERE id = ?", [newCycleId, user_id]);
      res.json({ message: "Salary reloaded successfully", cycle_id: newCycleId });
    });
  });
};
