import mongoose from "mongoose";

export const CATEGORIES = ["Loan", "Salary", "Material", "Travel", "Food", "Rent", "Other"];

const transactionSchema = new mongoose.Schema(
  {
    transactionNumber: { type: String, unique: true }, // e.g. TXN-2026-000001
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },

    date: { type: Date, required: true },
    amount: { type: Number, required: true, min: 0.01 },
    type: { type: String, enum: ["credit", "debit"], required: true, default: "debit" },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, required: true, trim: true, maxlength: 500 },

    paidTo: { type: String, required: true, trim: true, maxlength: 150 },
    paidBy: { type: String, required: true, trim: true, maxlength: 150 },

    nameOfCompany: { type: String, trim: true, maxlength: 150 },
    companyName: { type: String, trim: true, maxlength: 150 },

    billImage: {
      url: { type: String, default: null },
      publicId: { type: String, default: null }, // Cloudinary public_id, for safe deletion
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ clientId: 1, date: -1 });
transactionSchema.index({ paidTo: "text", description: "text", companyName: "text" });

// Atomically reserves the next sequence number for a given year via a counters collection,
// so concurrent inserts can never collide on the same transaction number.
const Counter = mongoose.model(
  "Counter",
  new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } })
);

transactionSchema.pre("save", async function assignTransactionNumber(next) {
  if (!this.isNew) return next();
  const year = new Date(this.date || Date.now()).getFullYear();
  const key = `txn-${year}`;
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.transactionNumber = `TXN-${year}-${String(counter.seq).padStart(6, "0")}`;
  next();
});

export default mongoose.model("Transaction", transactionSchema);
