require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { ca: fs.readFileSync("ca.pem") },
});

// ✅ For callback-based queries (old code)
connection.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Database connected successfully!");
  }
});

// ✅ Promise wrapper for async/await (new AI feature)
const promiseConnection = connection.promise();

// Export both
module.exports = { connection, promiseConnection };