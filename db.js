require("dotenv").config();
const mysql = require("mysql2");
const fs = require("fs");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    ca: fs.readFileSync("ca.pem")
  }
});

db.connect((err) => {
  if (err) throw err;
  console.log("✅ Database connected!");
});

module.exports = db;
