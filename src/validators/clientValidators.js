import { body } from "express-validator";

export const createClientRules = [
  body("name").isString().trim().isLength({ min: 2, max: 150 }),
  body("description").optional().isString().isLength({ max: 500 }),
  body("companyName").optional().isString().isLength({ max: 150 }),
  body("location").optional().isString().isLength({ max: 200 }),
  body("parentClient").optional({ nullable: true }).isMongoId(),
  body("openingBalance").optional().isFloat({ min: 0 }),
  body("openingBalanceType").optional().isIn(["credit", "debit"]),
  body("paidByOptions").optional().isArray(),
  body("paidByOptions.*").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("paidToOptions").optional().isArray(),
  body("paidToOptions.*").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("goalAmount").optional().isFloat({ min: 0 }),
];

export const updateClientRules = [
  body("name").optional().isString().trim().isLength({ min: 2, max: 150 }),
  body("description").optional().isString().isLength({ max: 500 }),
  body("companyName").optional().isString().isLength({ max: 150 }),
  body("location").optional().isString().isLength({ max: 200 }),
  body("openingBalance").optional().isFloat({ min: 0 }),
  body("openingBalanceType").optional().isIn(["credit", "debit"]),
  body("paidByOptions").optional().isArray(),
  body("paidByOptions.*").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("paidToOptions").optional().isArray(),
  body("paidToOptions.*").optional().isString().trim().isLength({ min: 1, max: 150 }),
  body("goalAmount").optional().isFloat({ min: 0 }),
];
