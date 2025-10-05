const db = require("../db");

// ➕ Add a new expense
exports.addExpense = (req, res) => {
  const { user_id, amount, budget_type, category, note, expense_date } = req.body;

  if (!user_id || !amount || !budget_type || !expense_date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const sql = `
    INSERT INTO expenses (user_id, amount, budget_type, category, note, expense_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, amount, budget_type, category, note, expense_date], (err, result) => {
    if (err) {
      console.error("Error inserting expense:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.status(201).json({
      message: "Expense added successfully",
      expenseId: result.insertId,
    });
  });
};

// 📄 Get all expenses for a user
exports.getUserExpenses = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) return res.status(400).json({ message: "User ID is required" });

  const sql = "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC";

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching expenses:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
};

// 🗑️ Delete an expense (optional)
exports.deleteExpense = (req, res) => {
  const { id } = req.params;

  if (!id) return res.status(400).json({ message: "Expense ID required" });

  const sql = "DELETE FROM expenses WHERE id = ?";

  db.query(sql, [id], (err) => {
    if (err) {
      console.error("Error deleting expense:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json({ message: "Expense deleted successfully" });
  });
};
