import Transaction from "../models/Transaction.js";
import Client from "../models/Client.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { applyLedgerDelta, deltaForCreate, deltaForReverse, deltaForUpdate } from "../utils/ledger.js";

async function assertClientAccess(user, clientId) {
  const client = await Client.findOne({ _id: clientId, isDeleted: false });
  if (!client) throw new ApiError(404, "Client not found.");

  if (user.role !== "super_admin") {
    const allowed = user.assignedClients?.some((id) => id.toString() === clientId);
    if (!allowed) throw new ApiError(403, "You don't have access to this client.");
  }
  return client;
}

async function collectDescendantClientIds(rootClientId) {
  const descendants = [];
  const queue = [rootClientId];

  while (queue.length) {
    const currentId = queue.shift();
    const children = await Client.find({ parentClient: currentId, isDeleted: false }, { _id: 1 });
    for (const child of children) {
      descendants.push(child._id);
      queue.push(child._id);
    }
  }

  return descendants;
}

export const listTransactionsForClient = asyncHandler(async (req, res) => {
  const { id: clientId } = req.params;
  const client = await assertClientAccess(req.user, clientId);

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const sortField = ["date", "amount", "createdAt", "category", "type"].includes(req.query.sort)
    ? req.query.sort
    : "date";
  const sortDir = req.query.order === "asc" ? 1 : -1;

  const relatedClientIds = [client._id, ...(await collectDescendantClientIds(client._id))];
  const filter = { clientId: { $in: relatedClientIds }, isDeleted: false };

  if (req.query.type) filter.type = req.query.type;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.paidBy) filter.paidBy = req.query.paidBy;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {};
    if (req.query.dateFrom) filter.date.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.date.$lte = new Date(req.query.dateTo);
  }
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ [sortField]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("createdBy", "name email"),
    Transaction.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: transactions,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, isDeleted: false })
    .populate("createdBy", "name email")
    .populate("updatedBy", "name email");
  if (!txn) throw new ApiError(404, "Transaction not found.");

  await assertClientAccess(req.user, txn.clientId.toString());
  res.json({ success: true, data: txn });
});

export const createTransaction = asyncHandler(async (req, res) => {
  const { id: clientId } = req.params;
  await assertClientAccess(req.user, clientId);

  const txn = await Transaction.create({
    ...req.body,
    clientId,
    createdBy: req.user._id,
  });

  // Keep the client's cached balance in step with this write. If this call
  // fails after the transaction was saved, the numbers can drift — the
  // reconciliation job (see reportController's aggregation) is the backstop
  // for that rare case, not the primary mechanism.
  await applyLedgerDelta(clientId, deltaForCreate(txn.type, txn.amount));

  if (txn.type === "credit" && txn.paidTo) {
    await Client.updateOne(
      { _id: clientId, paidToOptions: { $ne: txn.paidTo } },
      { $push: { paidToOptions: txn.paidTo } }
    );
  }

  await recordAudit({
    action: "TRANSACTION_CREATED",
    entityType: "Transaction",
    entityId: txn._id,
    newValue: txn.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.status(201).json({ success: true, data: txn });
});

export const updateTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, isDeleted: false });
  if (!txn) throw new ApiError(404, "Transaction not found.");

  await assertClientAccess(req.user, txn.clientId.toString());

  const oldValue = txn.toObject();
  const oldType = txn.type;
  const oldAmount = txn.amount;

  const editableFields = [
    "date",
    "amount",
    "type",
    "category",
    "description",
    "paidTo",
    "paidBy",
    "nameOfCompany",
    "companyName",
  ];
  for (const field of editableFields) {
    if (req.body[field] !== undefined) txn[field] = req.body[field];
  }
  txn.updatedBy = req.user._id;
  await txn.save();

  if (txn.type === "credit" && txn.paidTo) {
    await Client.updateOne(
      { _id: txn.clientId, paidToOptions: { $ne: txn.paidTo } },
      { $push: { paidToOptions: txn.paidTo } }
    );
  }

  // Only touch the cached balance if type or amount actually changed
  if (txn.type !== oldType || txn.amount !== oldAmount) {
    await applyLedgerDelta(
      txn.clientId,
      deltaForUpdate(oldType, oldAmount, txn.type, txn.amount)
    );
  }

  await recordAudit({
    action: "TRANSACTION_UPDATED",
    entityType: "Transaction",
    entityId: txn._id,
    oldValue,
    newValue: txn.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: txn });
});

// Soft delete — Super Admin only, per the blueprint's permission table
export const deleteTransaction = asyncHandler(async (req, res) => {
  const txn = await Transaction.findOne({ _id: req.params.id, isDeleted: false });
  if (!txn) throw new ApiError(404, "Transaction not found.");

  txn.isDeleted = true;
  txn.deletedBy = req.user._id;
  txn.deletedAt = new Date();
  await txn.save();

  await applyLedgerDelta(txn.clientId, deltaForReverse(txn.type, txn.amount));

  await recordAudit({
    action: "TRANSACTION_DELETED",
    entityType: "Transaction",
    entityId: txn._id,
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Transaction moved to trash." });
});
