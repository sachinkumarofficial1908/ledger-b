import ILovePDFApi from "@ilovepdf/ilovepdf-nodejs";
import ILovePDFFile from "@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { env } from "../config/env.js";

function normalizeItems(items = []) {
  return (items || []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const lineTotal = Number((quantity * unitPrice).toFixed(2));
    return {
      itemName: item.itemName || "",
      description: item.description || "",
      quantity,
      unit: item.unit || "pcs",
      unitPrice,
      lineTotal,
    };
  });
}

function calculateTotals(payload) {
  const items = normalizeItems(payload.items || []);
  const subtotal = Number(items.reduce((sum, item) => sum + (item.lineTotal || 0), 0).toFixed(2));
  const taxAmount = Number(Number(payload.taxAmount || 0).toFixed(2));
  const shippingCost = Number(Number(payload.shippingCost || 0).toFixed(2));
  const discountAmount = Number(Number(payload.discountAmount || 0).toFixed(2));
  const grandTotal = Number((subtotal + taxAmount + shippingCost - discountAmount).toFixed(2));

  return { items, subtotal, taxAmount, shippingCost, discountAmount, grandTotal };
}

function serializePurchaseOrder(po) {
  const obj = po.toObject ? po.toObject() : po;
  return {
    ...obj,
    orderDate: obj.orderDate ? new Date(obj.orderDate).toISOString() : null,
    expectedDeliveryDate: obj.expectedDeliveryDate ? new Date(obj.expectedDeliveryDate).toISOString() : null,
  };
}

export const listPurchaseOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { search } = req.query;

  const filter = { isDeleted: false };
  if (search) {
    filter.$or = [
      { poNumber: { $regex: search, $options: "i" } },
      { vendorName: { $regex: search, $options: "i" } },
    ];
  }

  const purchaseOrders = await PurchaseOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  const total = await PurchaseOrder.countDocuments(filter);

  res.json({
    success: true,
    data: purchaseOrders.map(serializePurchaseOrder),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });
  if (!purchaseOrder) throw new ApiError(404, "Purchase order not found.");

  res.json({ success: true, data: serializePurchaseOrder(purchaseOrder) });
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const computed = calculateTotals(req.body);
  const purchaseOrder = await PurchaseOrder.create({
    ...req.body,
    ...computed,
    createdBy: req.user._id,
  });

  await recordAudit({
    action: "PURCHASE_ORDER_CREATED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrder._id,
    newValue: purchaseOrder.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: serializePurchaseOrder(purchaseOrder) });
});

export const updatePurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });
  if (!purchaseOrder) throw new ApiError(404, "Purchase order not found.");

  const oldValue = purchaseOrder.toObject();
  const computed = calculateTotals({ ...purchaseOrder.toObject(), ...req.body });
  Object.assign(purchaseOrder, { ...req.body, ...computed });
  await purchaseOrder.save();

  await recordAudit({
    action: "PURCHASE_ORDER_UPDATED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrder._id,
    oldValue,
    newValue: purchaseOrder.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: serializePurchaseOrder(purchaseOrder) });
});

export const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: false });
  if (!purchaseOrder) throw new ApiError(404, "Purchase order not found.");

  purchaseOrder.isDeleted = true;
  purchaseOrder.deletedBy = req.user._id;
  purchaseOrder.deletedAt = new Date();
  await purchaseOrder.save();

  await recordAudit({
    action: "PURCHASE_ORDER_DELETED",
    entityType: "PurchaseOrder",
    entityId: purchaseOrder._id,
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Purchase order moved to trash." });
});

// Converts a client-generated purchase order .docx into a PDF via the iLovePDF
// API, so the download matches the DOCX exactly instead of a separately
// hand-rolled PDF layout. The DOCX bytes arrive as a raw request body
// (see the express.raw() middleware on this route).
export const convertPurchaseOrderDocxToPdf = asyncHandler(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw new ApiError(400, "No DOCX file was received.");
  }
  if (!env.ILOVEPDF_PUBLIC_KEY || !env.ILOVEPDF_SECRET_KEY) {
    throw new ApiError(500, "PDF conversion is not configured on the server.");
  }

  const ilovepdf = new ILovePDFApi(env.ILOVEPDF_PUBLIC_KEY, env.ILOVEPDF_SECRET_KEY);
  const task = ilovepdf.newTask("officepdf");

  let pdfData;
  try {
    await task.start();
    await task.addFile(ILovePDFFile.fromArray(req.body, "purchase-order.docx"));
    await task.process();
    pdfData = await task.download();
  } catch (err) {
    throw new ApiError(502, "PDF conversion failed. Please try again.", err.message);
  }

  res.set("Content-Type", "application/pdf");
  res.set("Content-Disposition", 'attachment; filename="purchase-order.pdf"');
  res.send(Buffer.from(pdfData));
});

export const restorePurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await PurchaseOrder.findOne({ _id: req.params.id, isDeleted: true });
  if (!purchaseOrder) throw new ApiError(404, "Deleted purchase order not found.");

  purchaseOrder.isDeleted = false;
  purchaseOrder.deletedBy = null;
  purchaseOrder.deletedAt = null;
  await purchaseOrder.save();

  res.json({ success: true, data: serializePurchaseOrder(purchaseOrder) });
});
