const db = require("../db");
const fetch = require("node-fetch");

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

        // 🔹 Step 3: After adding expense, check salary usage and notify if needed
        checkSalaryAndNotify(user_id);
      }
    );
  });
};

// ⚙️ Helper Function - Check Salary Usage and Send Notifications
function checkSalaryAndNotify(user_id) {
  // Get total spent for current cycle
  const totalSpentQuery = `
    SELECT SUM(amount) AS total
    FROM expenses e
    JOIN users u ON e.user_id = u.id
    WHERE e.user_id = ? AND e.cycle_id = u.current_cycle_id
  `;

  db.query(totalSpentQuery, [user_id], (err1, result1) => {
    if (err1) {
      console.error("Error calculating total spent:", err1);
      return;
    }

    const totalSpent = result1[0].total || 0;

    // Get salary of current cycle
    const salaryQuery = `
      SELECT sc.salary, u.expo_token
      FROM salary_cycles sc
      JOIN users u ON sc.id = u.current_cycle_id
      WHERE sc.user_id = ? AND sc.id = u.current_cycle_id
    `;

    db.query(salaryQuery, [user_id], async (err2, result2) => {
      if (err2 || result2.length === 0) {
        console.error("Error fetching salary:", err2);
        return;
      }

      const salary = result2[0].salary;
      const expoToken = result2[0].expo_token;
      const spentPercent = (totalSpent / salary) * 100;

      let alertLevel = null;
      if (spentPercent >= 100) alertLevel = "100%";
      else if (spentPercent >= 80 && spentPercent < 100) alertLevel = "80%";
      else if (spentPercent >= 50 && spentPercent < 80) alertLevel = "50%";
      else if (spentPercent >= 30 && spentPercent < 50) alertLevel = "30%";

      if (!alertLevel) return;

      const title = "💰 Budget Alert!";
      const message = `You have spent ${alertLevel} of your salary. Please check your expenses.`;

      // Save notification in DB
      db.query(
        "INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)",
        [user_id, title, message],
        (err3) => {
          if (err3) console.error("Error saving notification:", err3);
        }
      );

      // Send push notification if Expo token exists
      if (expoToken) {
        sendPushNotification(expoToken, title, message);
      }
    });
  });
}

// 🔔 Helper function to send Expo Push Notification
async function sendPushNotification(expoToken, title, message) {
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
        body: message,
      }),
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
    if (err) {
      console.error("Error fetching expenses:", err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
};

// 🗑️ Delete an expense
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
