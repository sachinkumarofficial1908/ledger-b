import { body } from "express-validator";

export const loginRules = [
  body("email").isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
  body("password").isString().isLength({ min: 1 }).withMessage("Password is required."),
];

export const changePasswordRules = [
  body("currentPassword").isString().notEmpty().withMessage("Current password is required."),
  body("newPassword")
    .isString()
    .isLength({ min: 8 })
    .withMessage("New password must be at least 8 characters."),
];
