import mongoose, { Document, Schema } from 'mongoose';



const accountsReceivableSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.Mixed,
      required: false,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
    },
    dueDate: {
      type: Date,
      required: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    journalEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'JournalEntry',
    },
  },
  {
    timestamps: true,
  }
);

accountsReceivableSchema.index({ invoiceNumber: 1 });
accountsReceivableSchema.index({ status: 1 });

const AccountsReceivable = mongoose.model('AccountsReceivable', accountsReceivableSchema);
export default AccountsReceivable;
