const db = require("../db");
const fetch = require("node-fetch");

exports.addExpense = (req, res) => {
  const { user_id, amount, budget_type, category, note, expense_date } = req.body;

  if (!user_id || !amount || !budget_type || !expense_date)
    return res.status(400).json({ message: "Missing required fields" });

  const getCycleQuery = "SELECT current_cycle_id FROM users WHERE id = ?";
  db.query(getCycleQuery, [user_id], (err, results) => {
    if (err || results.length === 0)
      return res.status(500).json({ message: "Error fetching user cycle" });

    const cycle_id = results[0].current_cycle_id;

    const insertQuery = `
      INSERT INTO expenses (user_id, amount, budget_type, category, note, expense_date, cycle_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    db.query(insertQuery, [user_id, amount, budget_type, category, note, expense_date, cycle_id], (err2, result) => {
      if (err2) return res.status(500).json({ message: "Database error" });

      res.status(201).json({ message: "Expense added successfully", expenseId: result.insertId });
      checkSalaryAndNotify(user_id);
    });
  });
};

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
