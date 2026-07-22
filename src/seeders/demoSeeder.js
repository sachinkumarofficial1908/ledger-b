/**
 * Demo data seeder (optional)
 * ----------------------------
 * Seeds one sample site with three subclients and a handful of
 * transactions, mirroring the example in the project blueprint.
 * Requires the admin seeder to have been run first.
 *
 * Usage: npm run seed:demo
 */

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Client from "../models/Client.js";
import Transaction from "../models/Transaction.js";
import { applyLedgerDelta, deltaForCreate } from "../utils/ledger.js";
import { logger } from "../utils/logger.js";

async function run() {
  if (!process.env.MONGO_URI) {
    logger.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  logger.info("Connected to MongoDB for demo seeding.");

  const superAdmin = await User.findOne({ role: "super_admin" });
  if (!superAdmin) {
    logger.error('No Super Admin found. Run "npm run seed:admin" first.');
    process.exit(1);
  }

  const existing = await Client.findOne({ name: "Delhi Arhat", parentClient: null });
  if (existing) {
    logger.info('Demo client "Delhi Arhat" already exists. Skipping.');
    process.exit(0);
  }

  const site = await Client.create({
    name: "Delhi Arhat",
    companyName: "Aditri Constructions Services",
    location: "Delhi, India",
    paidByOptions: ["Admin", "Cash", "Bank"],
    createdBy: superAdmin._id,
  });

  const subclientNames = ["SM Electronic", "ABC Transport", "Raj Labour Contractor"];
  const subclients = await Client.insertMany(
    subclientNames.map((name) => ({
      name,
      parentClient: site._id,
      paidByOptions: ["Admin", "Cash", "Bank"],
      createdBy: superAdmin._id,
    }))
  );

  const demoTransactions = [
    {
      clientId: site._id,
      date: new Date("2026-06-01"),
      amount: 500000,
      type: "credit",
      category: "Loan",
      description: "Advance received for FGD project",
      paidTo: "Delhi Arhat",
      paidBy: "Admin",
      createdBy: superAdmin._id,
    },
    {
      clientId: site._id,
      date: new Date("2026-06-10"),
      amount: 1000000,
      type: "debit",
      category: "Material",
      description: "Cement and steel purchase",
      paidTo: "Sunil Hardware",
      paidBy: "Cash",
      createdBy: superAdmin._id,
    },
    {
      clientId: subclients[0]._id,
      date: new Date("2026-06-12"),
      amount: 45000,
      type: "debit",
      category: "Material",
      description: "Electrical fittings",
      paidTo: "SM Electronic",
      paidBy: "Bank",
      createdBy: superAdmin._id,
    },
  ];

  for (const txnData of demoTransactions) {
    const txn = await Transaction.create(txnData);
    await applyLedgerDelta(txn.clientId, deltaForCreate(txn.type, txn.amount));
  }

  logger.info("Demo data seeded: 1 site, 3 subclients, 3 transactions.");
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error(`Demo seeder failed: ${err.message}`);
  process.exit(1);
});
