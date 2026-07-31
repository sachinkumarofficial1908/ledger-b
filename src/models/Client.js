import mongoose from "mongoose";

const clientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 500 },
    companyName: { type: String, trim: true, maxlength: 150 },
    location: { type: String, trim: true, maxlength: 200 },

    // Self-reference: null = top-level client (site), set = subclient
    parentClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null },

    openingBalance: { type: Number, default: 0, min: 0 },
    openingBalanceType: { type: String, enum: ["credit", "debit"], default: "credit" },
    paidByOptions: { type: [String], default: [] },
    paidToOptions: { type: [String], default: [] },

    // Optional savings/collection target for this client — purely a display
    // aid for the Overview page's goal-progress widget. Never read by the
    // balance virtual or any ledger delta math.
    goalAmount: { type: Number, default: 0, min: 0 },

    // Denormalized running totals — updated atomically (via $inc) on every transaction
    // write instead of being recomputed by aggregation on every read. At a few dozen
    // transactions the aggregation approach is fine; once a site has thousands of
    // entries, re-summing all of them on every dashboard load stops scaling. These
    // fields are the source of truth for display; the aggregation in reportController
    // still exists for category/monthly breakdowns and doubles as a reconciliation check.
    cachedTotalCredit: { type: Number, default: 0 },
    cachedTotalDebit: { type: Number, default: 0 },
    cachedTransactionCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Soft delete — financial records are never hard-deleted
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

clientSchema.index({ parentClient: 1 });
clientSchema.index({ name: "text", companyName: "text" });

// Single source of truth for "what does this client currently owe/is owed" —
// computed from the cached totals rather than stored twice, so it can never drift.
clientSchema.virtual("balance").get(function computeBalance() {
  const openingSigned = this.openingBalanceType === "credit" ? this.openingBalance : -this.openingBalance;
  return openingSigned + (this.cachedTotalCredit || 0) - (this.cachedTotalDebit || 0);
});
clientSchema.set("toJSON", { virtuals: true });
clientSchema.set("toObject", { virtuals: true });

// Excludes soft-deleted clients unless explicitly asked for
clientSchema.query.notDeleted = function notDeleted() {
  return this.where({ isDeleted: false });
};

export default mongoose.model("Client", clientSchema);
