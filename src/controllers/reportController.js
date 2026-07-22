import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Client from "../models/Client.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

function buildDateMatch(query) {
  const match = { isDeleted: false };
  if (query.dateFrom || query.dateTo) {
    match.date = {};
    if (query.dateFrom) match.date.$gte = new Date(query.dateFrom);
    if (query.dateTo) match.date.$lte = new Date(query.dateTo);
  }
  return match;
}

// GET /api/reports/summary — overall totals, category-wise, monthly
export const summaryReport = asyncHandler(async (req, res) => {
  const match = buildDateMatch(req.query);

  if (req.user.role !== "super_admin") {
    match.clientId = { $in: req.user.assignedClients };
  }

  const [byType, byCategory, byMonth] = await Promise.all([
    Transaction.aggregate([{ $match: match }, { $group: { _id: "$type", total: { $sum: "$amount" } } }]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { category: "$category", type: "$type" }, total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const totalCredit = byType.find((t) => t._id === "credit")?.total || 0;
  const totalDebit = byType.find((t) => t._id === "debit")?.total || 0;

  res.json({
    success: true,
    data: {
      totalCredit,
      totalDebit,
      netBalance: totalCredit - totalDebit,
      categoryWise: byCategory,
      monthly: byMonth,
    },
  });
});

// GET /api/reports/client/:id — single client / subclient report
export const clientReport = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const client = await Client.findOne({ _id: id, isDeleted: false });
  if (!client) throw new ApiError(404, "Client not found.");

  if (req.user.role !== "super_admin") {
    const allowed = req.user.assignedClients?.some((cid) => cid.toString() === id);
    if (!allowed) throw new ApiError(403, "You don't have access to this client.");
  }

  const match = { ...buildDateMatch(req.query), clientId: new mongoose.Types.ObjectId(id) };

  const [byType, byCategory] = await Promise.all([
    Transaction.aggregate([{ $match: match }, { $group: { _id: "$type", total: { $sum: "$amount" } } }]),
    Transaction.aggregate([
      { $match: match },
      { $group: { _id: { category: "$category", type: "$type" }, total: { $sum: "$amount" } } },
    ]),
  ]);

  const totalCredit = byType.find((t) => t._id === "credit")?.total || 0;
  const totalDebit = byType.find((t) => t._id === "debit")?.total || 0;
  const openingSigned =
    client.openingBalanceType === "credit" ? client.openingBalance : -client.openingBalance;

  res.json({
    success: true,
    data: {
      client: { id: client._id, name: client.name },
      openingBalance: client.openingBalance,
      openingBalanceType: client.openingBalanceType,
      totalCredit,
      totalDebit,
      closingBalance: openingSigned + totalCredit - totalDebit,
      categoryWise: byCategory,
    },
  });
});
