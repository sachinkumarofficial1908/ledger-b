import mongoose from "mongoose";

const purchaseOrderItemSchema = new mongoose.Schema(
  {
    itemName: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, trim: true, maxlength: 300 },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, trim: true, maxlength: 50, default: "pcs" },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, trim: true, unique: true, maxlength: 50 },
    vendorName: { type: String, required: true, trim: true, maxlength: 150 },
    vendorContactPerson: { type: String, trim: true, maxlength: 100 },
    vendorEmail: { type: String, trim: true, maxlength: 150 },
    vendorPhone: { type: String, trim: true, maxlength: 40 },
    vendorAddress: { type: String, trim: true, maxlength: 300 },
    orderDate: { type: Date, required: true, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    status: { type: String, enum: ["draft", "sent", "partially_received", "received", "cancelled"], default: "draft" },
    currency: { type: String, default: "INR", maxlength: 10 },
    items: { type: [purchaseOrderItemSchema], default: [] },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    notes: { type: String, trim: true, maxlength: 1000 },
    termsAndConditions: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

purchaseOrderSchema.index({ poNumber: 1 });
purchaseOrderSchema.index({ vendorName: "text", poNumber: "text" });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
