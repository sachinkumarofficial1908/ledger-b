import { Router } from "express";
import {
  listTransactionsForClient,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/transactionController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { idempotent } from "../middleware/idempotency.js";
import { createTransactionRules, updateTransactionRules } from "../validators/transactionValidators.js";

// Mounted twice in app.js: once at /api/clients/:id/transactions, once at /api/transactions
const router = Router({ mergeParams: true });

router.use(requireAuth);

// GET /api/clients/:id/transactions ; POST /api/clients/:id/transactions
router.get("/clients/:id/transactions", listTransactionsForClient);
router.post(
  "/clients/:id/transactions",
  idempotent("create-transaction"),
  createTransactionRules,
  validate,
  createTransaction
);

// GET /api/transactions/:id ; PUT /api/transactions/:id ; DELETE /api/transactions/:id
router.get("/transactions/:id", getTransaction);
router.put("/transactions/:id", updateTransactionRules, validate, updateTransaction);
router.delete("/transactions/:id", requireRole("super_admin"), deleteTransaction);

export default router;
