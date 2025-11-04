const db = require("../db");

// 🔔 Helper - Send Push Notification
async function sendPushNotification(expoToken, title, message) {
  try {
    if (!expoToken) return;
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
        body: message,
      }),
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

// ⚙️ Helper - Check Salary Usage and Send Notifications
async function checkSalaryAndNotify(user_id) {
  try {
    const [spentResult] = await db.query(
      `
      SELECT SUM(amount) AS total
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
    `,
      [user_id]
    );

    const totalSpent = spentResult[0].total || 0;

    const [salaryResult] = await db.query(
      `
      SELECT sc.salary, u.expo_token
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      WHERE sc.user_id = ?
    `,
      [user_id]
    );

    if (!salaryResult.length) return;

    const salary = salaryResult[0].salary;
    const expoToken = salaryResult[0].expo_token;
    const spentPercent = (totalSpent / salary) * 100;

    let alertLevel = null;
    if (spentPercent >= 100) alertLevel = "100%";
    else if (spentPercent >= 80) alertLevel = "80%";
    else if (spentPercent >= 50) alertLevel = "50%";
    else if (spentPercent >= 30) alertLevel = "30%";

    if (!alertLevel) return;

    const title = "💰 Budget Alert!";
    const message = `You have spent ${alertLevel} of your salary. Please check your expenses.`;

    await db.query(
      "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
      [user_id, title, message]
    );

    if (expoToken) await sendPushNotification(expoToken, title, message);
  } catch (err) {
    console.error("Error in checkSalaryAndNotify:", err);
  }
}

// ➕ Add a new expense
exports.addExpense = async (req, res) => {
  try {
    const { amount, budget_type, category, note, expense_date } = req.body;
    const user_id = req.user?.id || req.body.user_id; // ✅ Take from logged user if available

    if (!user_id || !amount || !budget_type || !expense_date)
      return res.status(400).json({ message: "Missing required fields" });

    // Step 1: Get user's current cycle ID
    const [cycleResult] = await db.query(
      "SELECT current_cycle_id FROM users WHERE id = ?",
      [user_id]
    );
    if (!cycleResult.length)
      return res.status(500).json({ message: "User cycle not found" });

    const cycle_id = cycleResult[0].current_cycle_id;

    // Step 2: Insert expense
    const [insertResult] = await db.query(
      `
      INSERT INTO expenses (user_id, amount, budget_type, category, note, expense_date, cycle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [user_id, amount, budget_type, category, note, expense_date, cycle_id]
    );

    // Step 3: Fetch salary and total spent
    const [summaryResult] = await db.query(
      `
      SELECT 
        sc.salary,
        COALESCE(SUM(e.amount), 0) AS total_spent
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      LEFT JOIN expenses e ON e.user_id = u.id AND e.cycle_id = u.current_cycle_id
      WHERE u.id = ?
    `,
      [user_id]
    );

    const { salary, total_spent } = summaryResult[0];
    const remaining = salary - total_spent;
    const percentUsed = ((total_spent / salary) * 100).toFixed(2);

    // Notify if needed
    await checkSalaryAndNotify(user_id);

    res.status(201).json({
      message: "Expense added successfully",
      expenseId: insertResult.insertId,
      salary,
      total_spent,
      remaining,
      percentUsed,
    });
  } catch (err) {
    console.error("Error adding expense:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// 📄 Get all expenses for a user
exports.getUserExpenses = async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;
    if (!user_id) return res.status(400).json({ message: "User ID is required" });

    const [rows] = await db.query(
      `
      SELECT e.*
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
      ORDER BY e.expense_date DESC
    `,
      [user_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Error fetching expenses:", err);
    res.status(500).json({ message: "Database error" });
  }
};

// 🗑️ Delete an expense
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Expense ID required" });

    await db.query("DELETE FROM expenses WHERE id = ?", [id]);
    res.json({ message: "Expense deleted successfully" });
  } catch (err) {
    console.error("Error deleting expense:", err);
    res.status(500).json({ message: "Database error" });
  }
};

// 📊 Get Salary + Total Spent Summary
exports.getExpenseSummary = async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;
    if (!user_id) return res.status(400).json({ message: "User ID is required" });

    const [spentResult] = await db.query(
      `
      SELECT SUM(e.amount) AS total_spent
      FROM expenses e
      JOIN users u ON e.user_id = u.id
      WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
    `,
      [user_id]
    );
    const totalSpent = spentResult[0].total_spent || 0;

    const [salaryResult] = await db.query(
      `
      SELECT sc.salary
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      WHERE sc.user_id = ?
    `,
      [user_id]
    );

    if (!salaryResult.length)
      return res.status(404).json({ message: "Salary data not found" });

    const salary = salaryResult[0].salary;

    res.json({ salary, spent: totalSpent });
  } catch (err) {
    console.error("Error fetching summary:", err);
    res.status(500).json({ message: "Database error" });
  }
};

// 📅 Get all salary cycles for a user
exports.getSalaryCycles = async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;
    const [rows] = await db.query(
      "SELECT * FROM salary_cycles WHERE user_id = ? ORDER BY started_at DESC",
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching salary cycles:", err);
    res.status(500).json({ message: "Database error" });
  }
};

// 📋 Get all expenses (admin/debug)
exports.getAllExpenses = async (req, res) => {
  try {
    const user_id = req.user?.id || req.params.user_id;
    const [rows] = await db.query(
      "SELECT * FROM expenses WHERE user_id = ? ORDER BY expense_date DESC",
      [user_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("Error fetching all expenses:", err);
    res.status(500).json({ message: "Database error" });
  }
};
