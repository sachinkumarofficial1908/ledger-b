import { body } from "express-validator";
import { CATEGORIES } from "../models/Transaction.js";

export const createTransactionRules = [
  body("date").isISO8601().withMessage("Enter a valid date.").toDate(),
  body("amount").isFloat({ gt: 0 }).withMessage("Amount must be a positive number."),
  body("type").isIn(["credit", "debit"]).withMessage("Type must be credit or debit."),
  body("category").isIn(CATEGORIES).withMessage("Choose a valid category."),
  body("description").isString().trim().isLength({ min: 1, max: 500 }),
  body("paidTo").isString().trim().isLength({ min: 1, max: 150 }),
  body("paidBy").isString().trim().isLength({ min: 1, max: 150 }),
  body("nameOfCompany").optional().isString().isLength({ max: 150 }),
  body("companyName").optional().isString().isLength({ max: 150 }),
];

export const updateTransactionRules = [
  body("date").optional().isISO8601().toDate(),
  body("amount").optional().isFloat({ gt: 0 }),
  body("type").optional().isIn(["credit", "debit"]),
  body("category").optional().isIn(CATEGORIES),
  body("description").optional().isString().trim().isLength({ min: 1, max: 500 }),
  body("paidTo").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("paidBy").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("nameOfCompany").optional().isString().isLength({ max: 150 }),
  body("companyName").optional().isString().isLength({ max: 150 }),
];
