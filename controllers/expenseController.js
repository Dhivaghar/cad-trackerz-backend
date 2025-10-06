const db = require("../db");

// ➕ Add a new expense
exports.addExpense = (req, res) => {
  const { user_id, amount, budget_type, category, note, expense_date } = req.body;

  if (!user_id || !amount || !budget_type || !expense_date) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  // 🔹 Step 1: Get user's current cycle ID
  const getCycleQuery = "SELECT current_cycle_id FROM users WHERE id = ?";
  db.query(getCycleQuery, [user_id], (err, results) => {
    if (err || results.length === 0) {
      console.error("Error fetching user cycle:", err);
      return res.status(500).json({ message: "Error fetching user cycle" });
    }

    const cycle_id = results[0].current_cycle_id;

    // 🔹 Step 2: Insert expense with cycle ID
    const insertQuery = `
      INSERT INTO expenses (user_id, amount, budget_type, category, note, expense_date, cycle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      insertQuery,
      [user_id, amount, budget_type, category, note, expense_date, cycle_id],
      (err2, result) => {
        if (err2) {
          console.error("Error inserting expense:", err2);
          return res.status(500).json({ message: "Database error" });
        }

        res.status(201).json({
          message: "Expense added successfully",
          expenseId: result.insertId,
        });
      }
    );
  });
};


// 📄 Get all expenses for a user
exports.getUserExpenses = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) return res.status(400).json({ message: "User ID is required" });

  const sql = `
    SELECT e.*
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
    ORDER BY e.expense_date DESC
  `;

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


// 📊 Get summary of expenses by category
exports.getExpenseSummary = (req, res) => {
  const { user_id } = req.params;

  if (!user_id) return res.status(400).json({ message: "User ID is required" });

  const sql = `
  SELECT category, SUM(amount) AS total_amount
  FROM expenses e
  JOIN users u ON e.user_id = u.id
  WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
  GROUP BY category
`;

  db.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error("Error fetching summary:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
};


