const db = require("../db");

// ➕ Save notification in DB
exports.addNotification = async (req, res) => {
  try {
    const { user_id, title, message } = req.body;

    if (!user_id || !message) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await db.query(
      "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
      [user_id, title || "Notification", message]
    );

    res.json({ message: "Notification added successfully" });
  } catch (err) {
    console.error("❌ Error adding notification:", err);
    res.status(500).json({ message: "Database error" });
  }
};

// 📬 Get all notifications for a user
exports.getUserNotifications = async (req, res) => {
  try {
    const { user_id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching notifications:", err);
    res.status(500).json({ message: "Database error" });
  }
};
