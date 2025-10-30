const db = require("../db");

// Save notification in DB
exports.addNotification = (req, res) => {
  const { user_id, title, message } = req.body;

  if (!user_id || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  db.query(
    "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
    [user_id, title, message],
    (err) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json({ message: "Notification added successfully" });
    }
  );
};

// Get all notifications for user
exports.getUserNotifications = (req, res) => {
  const { user_id } = req.params;
  db.query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json(rows);
    }
  );
};
