import { Router } from "express";
import { listUsers, createUser, updateUser, deleteUser } from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { createUserRules, updateUserRules } from "../validators/userValidators.js";

const router = Router();

// Only Super Admins manage other admin accounts
router.use(requireAuth, requireRole("super_admin"));

router.get("/", listUsers);
router.post("/", createUserRules, validate, createUser);
router.put("/:id", updateUserRules, validate, updateUser);
router.delete("/:id", deleteUser);

export default router;
