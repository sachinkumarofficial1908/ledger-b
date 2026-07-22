import Client from "../models/Client.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";

// Balance, credit, and debit come from the virtual + cached fields on the
// Client document (see models/Client.js) — no aggregation on the read path.
// This is what makes the dashboard and client list fast regardless of how
// many transactions a site has accumulated.
function withLedgerSummary(client) {
  const obj = client.toObject ? client.toObject() : client;
  return {
    ...obj,
    totalCredit: obj.cachedTotalCredit || 0,
    totalDebit: obj.cachedTotalDebit || 0,
    transactionCount: obj.cachedTransactionCount || 0,
    balance: obj.balance,
  };
}

export const listClients = asyncHandler(async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const { search } = req.query;

  const filter = { isDeleted: false, parentClient: null };
  if (req.user.role !== "super_admin") {
    filter._id = { $in: req.user.assignedClients };
  }
  if (search) {
    filter.$text = { $search: search };
  }

  const clients = await Client.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const total = await Client.countDocuments(filter);

  res.json({
    success: true,
    data: clients.map(withLedgerSummary),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

export const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
  if (!client) throw new ApiError(404, "Client not found.");

  const subclients = await Client.find({ parentClient: client._id, isDeleted: false });

  res.json({
    success: true,
    data: { ...withLedgerSummary(client), subclients: subclients.map(withLedgerSummary) },
  });
});

export const createClient = asyncHandler(async (req, res) => {
  const client = await Client.create({ ...req.body, createdBy: req.user._id });
  await recordAudit({
    action: "CLIENT_CREATED",
    entityType: "Client",
    entityId: client._id,
    newValue: client.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });
  res.status(201).json({ success: true, data: client });
});

export const updateClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
  if (!client) throw new ApiError(404, "Client not found.");

  const oldValue = client.toObject();
  Object.assign(client, req.body);
  await client.save();

  await recordAudit({
    action: "CLIENT_UPDATED",
    entityType: "Client",
    entityId: client._id,
    oldValue,
    newValue: client.toObject(),
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, data: client });
});

// Soft delete only — financial records are never permanently removed via the API
export const deleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, isDeleted: false });
  if (!client) throw new ApiError(404, "Client not found.");

  client.isDeleted = true;
  client.deletedBy = req.user._id;
  client.deletedAt = new Date();
  await client.save();

  await recordAudit({
    action: "CLIENT_DELETED",
    entityType: "Client",
    entityId: client._id,
    performedBy: req.user._id,
    ipAddress: req.ip,
  });

  res.json({ success: true, message: "Client moved to trash. A Super Admin can restore it." });
});

export const restoreClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, isDeleted: true });
  if (!client) throw new ApiError(404, "Deleted client not found.");

  client.isDeleted = false;
  client.deletedBy = null;
  client.deletedAt = null;
  await client.save();

  res.json({ success: true, data: client });
});
