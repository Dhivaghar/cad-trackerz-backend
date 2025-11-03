const db = require("../db");

// ➕ Add a new expense
exports.addExpense = (req, res) => {
  const { user_id, amount, budget_type, category, note, expense_date } = req.body;

  if (!user_id || !amount || !budget_type || !expense_date)
    return res.status(400).json({ message: "Missing required fields" });

  // 🔹 Step 1: Get user's current cycle ID
  const getCycleQuery = "SELECT current_cycle_id FROM users WHERE id = ?";
  db.query(getCycleQuery, [user_id], (err, results) => {
    if (err || results.length === 0)
      return res.status(500).json({ message: "Error fetching user cycle" });

    const cycle_id = results[0].current_cycle_id;

    // 🔹 Step 2: Insert expense
    const insertQuery = `
      INSERT INTO expenses (user_id, amount, budget_type, category, note, expense_date, cycle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(
      insertQuery,
      [user_id, amount, budget_type, category, note, expense_date, cycle_id],
      (err2, result) => {
        if (err2) return res.status(500).json({ message: "Database error" });

        // 🔹 Step 3: Fetch salary and total spent for that cycle
        const salaryQuery = `
          SELECT 
            sc.salary,
            COALESCE(SUM(e.amount), 0) AS total_spent
          FROM salary_cycles sc
          JOIN users u ON sc.id = u.current_cycle_id
          LEFT JOIN expenses e ON e.user_id = u.id AND e.cycle_id = u.current_cycle_id
          WHERE u.id = ?
        `;

        db.query(salaryQuery, [user_id], (err3, result3) => {
          if (err3)
            return res.status(500).json({ message: "Error fetching salary info" });

          const { salary, total_spent } = result3[0];
          const remaining = salary - total_spent;
          const percentUsed = ((total_spent / salary) * 100).toFixed(2);

          // 🔹 Step 4: Return the salary usage details
          res.status(201).json({
            message: "Expense added successfully",
            expenseId: result.insertId,
            salary,
            total_spent,
            remaining,
            percentUsed
          });
          // ✅ Trigger salary usage check and notification
          checkSalaryAndNotify(user_id);
        });
      }
    );
  });
};


// ⚙️ Helper - Check Salary Usage and Send Notifications
function checkSalaryAndNotify(user_id) {
  const totalSpentQuery = `
    SELECT SUM(amount) AS total
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
  `;

  db.query(totalSpentQuery, [user_id], (err1, result1) => {
    if (err1) return;

    const totalSpent = result1[0].total || 0;

    const salaryQuery = `
      SELECT sc.salary, u.expo_token
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      WHERE sc.user_id = ?
    `;

    db.query(salaryQuery, [user_id], async (err2, result2) => {
      if (err2 || result2.length === 0) return;

      const salary = result2[0].salary;
      const expoToken = result2[0].expo_token;
      const spentPercent = (totalSpent / salary) * 100;

      let alertLevel = null;
      if (spentPercent >= 100) alertLevel = "100%";
      else if (spentPercent >= 80) alertLevel = "80%";
      else if (spentPercent >= 50) alertLevel = "50%";
      else if (spentPercent >= 30) alertLevel = "30%";

      if (!alertLevel) return;

      const title = "💰 Budget Alert!";
      const message = `You have spent ${alertLevel} of your salary. Please check your expenses.`;

      db.query("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)", [user_id, title, message]);
      if (expoToken) sendPushNotification(expoToken, title, message);
    });
  });
}

// 🔔 Helper - Send Push Notification via Expo
async function sendPushNotification(expoToken, title, message) {
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ to: expoToken, sound: "default", title, body: message }),
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

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
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
};

// 🗑️ Delete an expense
exports.deleteExpense = (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: "Expense ID required" });

  const sql = "DELETE FROM expenses WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json({ message: "Expense deleted successfully" });
  });
};

// 📊 Get Salary + Total Spent Summary (✅ Updated for frontend)
exports.getExpenseSummary = (req, res) => {
  const { user_id } = req.params;
  if (!user_id) return res.status(400).json({ message: "User ID is required" });

  const totalSpentQuery = `
    SELECT SUM(e.amount) AS total_spent
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
  `;
  db.query(totalSpentQuery, [user_id], (err1, result1) => {
    if (err1) return res.status(500).json({ message: "Database error" });

    const totalSpent = result1[0].total_spent || 0;

    const salaryQuery = `
      SELECT sc.salary
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      WHERE sc.user_id = ?
    `;
    db.query(salaryQuery, [user_id], (err2, result2) => {
      if (err2 || result2.length === 0)
        return res.status(500).json({ message: "Database error" });

      const salary = result2[0].salary || 0;

      // ✅ Return format matching Expo frontend
      return res.json({ salary, spent: totalSpent });
    });
  });
};

// 📅 Get all salary cycles for a user
exports.getSalaryCycles = (req, res) => {
  const user_id = req.params.user_id;
  db.query(
    "SELECT * FROM salary_cycles WHERE user_id = ? ORDER BY started_at DESC",
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json(rows);
    }
  );
};

// 📋 Get all expenses (admin/debug)
exports.getAllExpenses = (req, res) => {
  const user_id = req.params.user_id;
  db.query(
    "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC",
    [user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });
      res.json(rows);
    }
  );
};
