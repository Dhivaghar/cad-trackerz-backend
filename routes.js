const express = require("express");
const router = express.Router();

// Controllers
const authController = require("./controllers/authController");
const expenseController = require("./controllers/expenseController");

// Auth Routes
router.post("/send-otp", authController.sendOtp);
router.post("/verify-otp", authController.verifyOtp);
router.post("/login", authController.login);

// Expense Routes
router.post("/expenses/add", expenseController.addExpense);
router.get("/expenses/:user_id", expenseController.getUserExpenses);
router.delete("/expenses/:id", expenseController.deleteExpense);

router.get("/expenses/summary/:user_id", expenseController.getExpenseSummary);

router.post("/user/update-salary", authController.updateSalary);

router.post("/user/reload-salary", authController.reloadSalary);


module.exports = router;
