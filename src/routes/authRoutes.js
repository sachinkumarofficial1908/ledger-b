import { Router } from "express";
import { login, logout, refresh, me, changePassword } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimiters.js";
import { validate } from "../middleware/validate.js";
import { loginRules, changePasswordRules } from "../validators/authValidators.js";

const router = Router();

router.post("/login", loginLimiter, loginRules, validate, login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, changePasswordRules, validate, changePassword);

export default router;
