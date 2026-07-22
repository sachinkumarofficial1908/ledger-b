/**
 * Reconciliation script
 * ----------------------
 * Recomputes every client's cachedTotalCredit / cachedTotalDebit /
 * cachedTransactionCount directly from the Transaction collection and
 * overwrites the cached fields. The cached fields are the fast path for
 * reads; this script is the ground truth check for when they might have
 * drifted (a crashed request between "transaction saved" and "balance
 * incremented", a manual DB edit, a bug). Safe to run anytime — it's
 * read-heavy and only writes if a mismatch is found.
 *
 * Usage: npm run reconcile           (report + fix)
 *        npm run reconcile -- --dry  (report only, no writes)
 */

import "dotenv/config";
import mongoose from "mongoose";
import Client from "../models/Client.js";
import Transaction from "../models/Transaction.js";
import { logger } from "../utils/logger.js";

const dryRun = process.argv.includes("--dry");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  logger.info(`Connected. Reconciling ledger balances${dryRun ? " (dry run)" : ""}...`);

  const clients = await Client.find({});
  let driftCount = 0;

  for (const client of clients) {
    const grouped = await Transaction.aggregate([
      { $match: { clientId: client._id, isDeleted: false } },
      { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const actualCredit = grouped.find((g) => g._id === "credit")?.total || 0;
    const actualDebit = grouped.find((g) => g._id === "debit")?.total || 0;
    const actualCount = grouped.reduce((sum, g) => sum + g.count, 0);

    const drifted =
      actualCredit !== (client.cachedTotalCredit || 0) ||
      actualDebit !== (client.cachedTotalDebit || 0) ||
      actualCount !== (client.cachedTransactionCount || 0);

    if (drifted) {
      driftCount += 1;
      logger.warn(
        `Drift on "${client.name}" (${client._id}): cached credit=${client.cachedTotalCredit} vs actual=${actualCredit}, ` +
          `cached debit=${client.cachedTotalDebit} vs actual=${actualDebit}`
      );
      if (!dryRun) {
        client.cachedTotalCredit = actualCredit;
        client.cachedTotalDebit = actualDebit;
        client.cachedTransactionCount = actualCount;
        await client.save();
      }
    }
  }

  logger.info(
    driftCount === 0
      ? "No drift found. All cached balances match the transaction log."
      : `${driftCount} client(s) had drift.${dryRun ? " (not written — dry run)" : " Corrected."}`
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  logger.error(`Reconciliation failed: ${err.message}`);
  process.exit(1);
});
