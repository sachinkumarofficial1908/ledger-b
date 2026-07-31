import { Router, raw } from "express";
import {
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  restorePurchaseOrder,
  convertPurchaseOrderDocxToPdf,
} from "../controllers/purchaseOrderController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createPurchaseOrderRules, updatePurchaseOrderRules } from "../validators/purchaseOrderValidators.js";

const router = Router();

router.use(requireAuth);

router.get("/", listPurchaseOrders);
router.get("/:id", getPurchaseOrder);
router.post("/", createPurchaseOrderRules, validate, createPurchaseOrder);
router.put("/:id", updatePurchaseOrderRules, validate, updatePurchaseOrder);
router.delete("/:id", deletePurchaseOrder);
router.post("/:id/restore", restorePurchaseOrder);
router.post(
  "/convert-to-pdf",
  raw({ type: "application/octet-stream", limit: "20mb" }),
  convertPurchaseOrderDocxToPdf
);

export default router;
