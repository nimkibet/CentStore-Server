import mongoose, { Document, Schema } from 'mongoose';

const journalLineSchema = new Schema(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    accountCode: { type: String, trim: true },
    accountName: { type: String, trim: true },
    debit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    credit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const journalEntrySchema = new Schema(
  {
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    reference: {
      type: String,
      trim: true,
    },
    lines: {
      type: [journalLineSchema],
      validate: [
        {
          validator: function (lines) {
            return Array.isArray(lines) && lines.length >= 2;
          },
          message: 'A journal entry must contain at least two line items.',
        },
        {
          validator: function (lines) {
            if (!Array.isArray(lines)) return false;
            const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
            const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
            return Math.abs(totalDebit - totalCredit) < 0.001;
          },
          message: 'Journal entry is unbalanced: total debits must equal total credits.',
        },
      ],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Staff',
    },
    status: {
      type: String,
      enum: ['draft', 'posted'],
      default: 'posted',
    },
  },
  {
    timestamps: true,
  }
);

journalEntrySchema.index({ date: -1 });

const JournalEntry = mongoose.model('JournalEntry', journalEntrySchema);
export default JournalEntry;
