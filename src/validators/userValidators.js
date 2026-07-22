import { body } from "express-validator";

export const createUserRules = [
  body("name").isString().trim().isLength({ min: 2, max: 100 }),
  body("email").isEmail().normalizeEmail(),
  body("password").isString().isLength({ min: 8 }),
  body("role").optional().isIn(["super_admin", "admin"]),
];

export const updateUserRules = [
  body("name").optional().isString().trim().isLength({ min: 2, max: 100 }),
  body("role").optional().isIn(["super_admin", "admin"]),
  body("isActive").optional().isBoolean(),
  body("assignedClients").optional().isArray(),
];
