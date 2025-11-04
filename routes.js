const express = require("express");
const router = express.Router();

// Controllers
const authController = require("./controllers/authController");
const expenseController = require("./controllers/expenseController");
const notificationController = require("./controllers/notificationController");
const { generateSuggestion } = require("./controllers/aiController");

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

router.get("/cycles/:user_id", expenseController.getSalaryCycles);
router.get("/expenses/all/:user_id", expenseController.getAllExpenses);

router.get("/notifications/:user_id", notificationController.getUserNotifications);
router.post("/notifications/add", notificationController.addNotification);

router.post("/generate-suggestion", generateSuggestion);
router.get("/get-suggestions/:user_id", getAllSuggestions);


module.exports = router;
