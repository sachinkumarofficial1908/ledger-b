import Client from "../models/Client.js";

/**
 * Applies a delta to a client's cached running totals atomically.
 *
 * Why $inc instead of read-modify-write: two admins can post transactions
 * for the same client at the same moment. A read-then-write ("get balance,
 * add amount, save") loses updates under concurrent writes — classic
 * lost-update race condition. MongoDB's $inc is applied atomically at the
 * storage layer regardless of how many requests hit it simultaneously, so
 * no in-app locking, no multi-document transaction, no replica-set
 * requirement — just a correct counter under concurrency.
 *
 * @param {string} clientId
 * @param {{ creditDelta?: number, debitDelta?: number, countDelta?: number }} deltas
 */
export async function applyLedgerDelta(clientId, { creditDelta = 0, debitDelta = 0, countDelta = 0 }) {
  if (!creditDelta && !debitDelta && !countDelta) return;

  await Client.findByIdAndUpdate(clientId, {
    $inc: {
      cachedTotalCredit: creditDelta,
      cachedTotalDebit: debitDelta,
      cachedTransactionCount: countDelta,
    },
  });
}

/** Delta for creating a new transaction of a given type/amount. */
export function deltaForCreate(type, amount) {
  return type === "credit"
    ? { creditDelta: amount, countDelta: 1 }
    : { debitDelta: amount, countDelta: 1 };
}

/** Delta for reversing a transaction (used on soft delete). */
export function deltaForReverse(type, amount) {
  return type === "credit"
    ? { creditDelta: -amount, countDelta: -1 }
    : { debitDelta: -amount, countDelta: -1 };
}

/**
 * Delta for editing a transaction — reverses the old value and applies the
 * new one in a single $inc call so the counter never passes through an
 * inconsistent intermediate state.
 */
export function deltaForUpdate(oldType, oldAmount, newType, newAmount) {
  const reverse = deltaForReverse(oldType, oldAmount);
  const apply = deltaForCreate(newType, newAmount);
  return {
    creditDelta: (reverse.creditDelta || 0) + (apply.creditDelta || 0),
    debitDelta: (reverse.debitDelta || 0) + (apply.debitDelta || 0),
    countDelta: 0, // count doesn't change on edit, only on create/delete
  };
}
