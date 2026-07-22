import { Router } from "express";
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
  restoreClient,
} from "../controllers/clientController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { createClientRules, updateClientRules } from "../validators/clientValidators.js";

const router = Router();

router.use(requireAuth);

router.get("/", listClients);
router.get("/:id", getClient);

// Per the blueprint's permission table: Admins may add clients (optional in practice,
// enforce at the org's discretion) but only Super Admin can delete.
router.post("/", createClientRules, validate, createClient);
router.put("/:id", updateClientRules, validate, updateClient);
router.delete("/:id", requireRole("super_admin"), deleteClient);
router.post("/:id/restore", requireRole("super_admin"), restoreClient);

export default router;
