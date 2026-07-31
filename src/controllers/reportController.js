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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Scopes a client/transaction filter to whatever this user is allowed to see. */
async function resolveAccessibleClientIds(user) {
  if (user.role === "super_admin") {
    const all = await Client.find({ isDeleted: false }, { _id: 1 });
    return all.map((c) => c._id);
  }
  return user.assignedClients || [];
}

function monthBounds(offsetFromCurrent = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrent, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetFromCurrent + 1, 1);
  return { start, end };
}

// GET /api/reports/overview — aggregate totals across every accessible client,
// for the Overview dashboard (stat tiles, spending chart, top categories,
// recent activity, savings goals). Read-only; never touches cached ledger totals.
export const overviewReport = asyncHandler(async (req, res) => {
  const clientIds = await resolveAccessibleClientIds(req.user);

  if (!clientIds.length) {
    return res.json({
      success: true,
      data: {
        totalBalance: 0,
        income: 0,
        expenses: 0,
        incomeChangePct: 0,
        expensesChangePct: 0,
        savingsRate: 0,
        topCategories: [],
        monthlySpending: [],
        recentTransactions: [],
        goals: [],
      },
    });
  }

  const { start: thisMonthStart, end: thisMonthEnd } = monthBounds(0);
  const { start: lastMonthStart } = monthBounds(-1);
  const sixMonthsAgo = monthBounds(-5).start;

  const [
    clients,
    thisMonthByType,
    lastMonthByType,
    categoryRows,
    monthlyRows,
    recentTransactions,
  ] = await Promise.all([
    Client.find({ _id: { $in: clientIds }, isDeleted: false }),
    Transaction.aggregate([
      { $match: { clientId: { $in: clientIds }, isDeleted: false, date: { $gte: thisMonthStart, $lt: thisMonthEnd } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { clientId: { $in: clientIds }, isDeleted: false, date: { $gte: lastMonthStart, $lt: thisMonthStart } } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]),
    Transaction.aggregate([
      { $match: { clientId: { $in: clientIds }, isDeleted: false, type: "debit", date: { $gte: sixMonthsAgo } } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
      { $sort: { total: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { clientId: { $in: clientIds }, isDeleted: false, type: "debit", date: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, total: { $sum: "$amount" } } },
    ]),
    Transaction.find({ clientId: { $in: clientIds }, isDeleted: false })
      .sort({ date: -1, createdAt: -1 })
      .limit(6)
      .populate("clientId", "name"),
  ]);

  const totalBalance = clients.reduce((sum, c) => sum + (c.balance || 0), 0);

  const income = thisMonthByType.find((t) => t._id === "credit")?.total || 0;
  const expenses = thisMonthByType.find((t) => t._id === "debit")?.total || 0;
  const lastIncome = lastMonthByType.find((t) => t._id === "credit")?.total || 0;
  const lastExpenses = lastMonthByType.find((t) => t._id === "debit")?.total || 0;

  const pctChange = (current, previous) => {
    if (!previous) return current ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

  const topCategoryRows = categoryRows.slice(0, 3);
  const otherTotal = categoryRows.slice(3).reduce((sum, row) => sum + row.total, 0);
  const topCategories = [
    ...topCategoryRows.map((row) => ({ category: row._id, total: row.total })),
    ...(otherTotal > 0 ? [{ category: "Other", total: otherTotal }] : []),
  ];

  // Zero-fill the trailing 6 months so the bar chart always shows a full window.
  const monthlySpending = [];
  for (let i = 5; i >= 0; i--) {
    const { start } = monthBounds(-i);
    const match = monthlyRows.find(
      (row) => row._id.year === start.getFullYear() && row._id.month === start.getMonth() + 1
    );
    monthlySpending.push({
      label: MONTH_NAMES[start.getMonth()],
      total: match?.total || 0,
      isCurrent: i === 0,
    });
  }

  const goals = clients
    .filter((c) => c.goalAmount > 0)
    .map((c) => ({ id: c._id, name: c.name, balance: c.balance || 0, goalAmount: c.goalAmount }))
    .sort((a, b) => b.balance / b.goalAmount - a.balance / a.goalAmount)
    .slice(0, 3);

  res.json({
    success: true,
    data: {
      totalBalance,
      income,
      expenses,
      incomeChangePct: pctChange(income, lastIncome),
      expensesChangePct: pctChange(expenses, lastExpenses),
      savingsRate,
      topCategories,
      monthlySpending,
      recentTransactions: recentTransactions.map((t) => ({
        id: t._id,
        date: t.date,
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount,
        clientName: t.clientId?.name || "—",
      })),
      goals,
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
