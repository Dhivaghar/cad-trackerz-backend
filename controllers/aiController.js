const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();
const db = require("../db");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.generateSuggestion = async (req, res) => {
  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ message: "Missing user_id" });
  }

  try {
    // Step 1: Fetch last 2 months’ expense data
    const [expenses] = await db.query(`
      SELECT category, SUM(amount) AS total, MONTH(expense_date) AS month
      FROM expenses
      WHERE user_id = ?
      AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 2 MONTH)
      GROUP BY category, MONTH(expense_date)
      ORDER BY category, month
    `, [user_id]);

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expense data found." });
    }

    // Step 2: Generate AI Suggestion
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      You are an AI financial assistant for the CAD TRACKERZ app.

      Analyze the user's last 2 months of spending and identify the categories 
      where the spending is high or increasing.

      Give 2 to 3 short, direct suggestions in the following format:
      - You spent too much on <category>. Try reducing it to save more money.
      - Your <category> expenses are higher than before. You can avoid that to save more.
      - You can limit your <category> spending next month to save extra.

      Keep it short, friendly, and practical. Do not include extra explanations or emojis.

      Here’s the user's spending data:
      ${JSON.stringify(expenses, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const suggestion = result.response.text();

    // Step 3: Save the suggestion
    await db.query(
      "INSERT INTO ai_suggestions (user_id, suggestion) VALUES (?, ?)",
      [user_id, suggestion]
    );

    console.log("✅ AI Suggestion saved for user:", user_id);
    console.log("Suggestion Text:", suggestion);

    res.status(200).json({
      success: true,
      message: "AI suggestion generated and saved successfully",
      suggestion,
    });

  } catch (err) {
    console.error("❌ AI Suggestion Error:", err);
    res.status(500).json({ message: "Error generating AI suggestion" });
  }
};

// 📜 Get all saved suggestions for a user
exports.getAllSuggestions = async (req, res) => {
  const { user_id } = req.params;

  if (!user_id) {
    return res.status(400).json({ message: "Missing user_id" });
  }

  try {
    const [rows] = await db.query(
      "SELECT id, suggestion, created_at FROM ai_suggestions WHERE user_id = ? ORDER BY created_at DESC",
      [user_id]
    );
    res.status(200).json({ success: true, suggestions: rows });
  } catch (err) {
    console.error("Fetch AI suggestions error:", err);
    res.status(500).json({ message: "Error fetching AI suggestions" });
  }
};
