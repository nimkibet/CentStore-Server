/**
 * autoAccounting.js
 * Creates double-entry GL journal entries automatically from business events.
 * Errors are caught and logged — they MUST NOT crash the primary business transaction.
 */
import JournalEntry from '../models/JournalEntry.js';
import Account from '../models/Account.js';

const findAccount = async (code) => {
  const acc = await Account.findOne({ code });
  if (!acc) throw new Error(`Account "${code}" not found. Call GET /api/erp/finance/accounts to seed defaults.`);
  return acc;
};

// POS Sale → DR Cash, CR Revenue, DR COGS, CR Inventory
export const createPOSSaleJournalEntry = async ({ orderId, totalAmount, cashierName }) => {
  try {
    const cogs = Math.round(totalAmount * 0.70);
    const [cash, rev, cogsAcc, inv] = await Promise.all([findAccount('1000'), findAccount('4000'), findAccount('5000'), findAccount('1200')]);
    await new JournalEntry({
      entryNumber: `JE-POS-${orderId.toString().slice(-8).toUpperCase()}`,
      date: new Date(), description: `POS Sale by ${cashierName}`, reference: `POS-${orderId}`, status: 'posted',
      lines: [
        { accountId: cash._id, accountCode: cash.code, accountName: cash.name, description: 'Cash received', debit: totalAmount, credit: 0 },
        { accountId: rev._id,  accountCode: rev.code,  accountName: rev.name,  description: 'Sales revenue',  debit: 0, credit: totalAmount },
        { accountId: cogsAcc._id, accountCode: cogsAcc.code, accountName: cogsAcc.name, description: 'COGS', debit: cogs, credit: 0 },
        { accountId: inv._id,  accountCode: inv.code,  accountName: inv.name,  description: 'Inventory reduction', debit: 0, credit: cogs }
      ], totalAmount
    }).save();
    console.log(`[AutoAccounting] POS entry created for order ${orderId}`);
  } catch (err) { console.error('[AutoAccounting] POS entry failed:', err.message); }
};

// PO Received → DR Inventory, CR AP
export const createPOReceivedJournalEntry = async ({ poId, vendorName, totalAmount }) => {
  try {
    const [inv, ap] = await Promise.all([findAccount('1200'), findAccount('2000')]);
    await new JournalEntry({
      entryNumber: `JE-PO-${poId.toString().slice(-8).toUpperCase()}`,
      date: new Date(), description: `PO received from ${vendorName}`, reference: `PO-${poId}`, status: 'posted',
      lines: [
        { accountId: inv._id, accountCode: inv.code, accountName: inv.name, description: 'Inventory received', debit: totalAmount, credit: 0 },
        { accountId: ap._id,  accountCode: ap.code,  accountName: ap.name,  description: `AP: ${vendorName}`, debit: 0, credit: totalAmount }
      ], totalAmount
    }).save();
    console.log(`[AutoAccounting] PO received entry created for PO ${poId}`);
  } catch (err) { console.error('[AutoAccounting] PO entry failed:', err.message); }
};

// Payroll Run → DR Expenses, CR AP (taxes), CR Cash (net pay)
export const createPayrollJournalEntry = async ({ period, totalGross, totalNet, totalPAYE, totalNSSF, totalSHIF, totalHousingLevy }) => {
  try {
    const [exp, ap, cash] = await Promise.all([findAccount('5100'), findAccount('2000'), findAccount('1000')]);
    await new JournalEntry({
      entryNumber: `JE-PAY-${period.replace(/\s/g,'-').toUpperCase()}-${Date.now().toString().slice(-4)}`,
      date: new Date(), description: `Payroll: ${period}`, reference: `PAYROLL-${period}`, status: 'posted',
      lines: [
        { accountId: exp._id,  accountCode: exp.code,  accountName: exp.name,  description: `Gross salaries ${period}`, debit: totalGross, credit: 0 },
        { accountId: ap._id,   accountCode: ap.code,   accountName: ap.name,   description: `PAYE payable ${period}`,   debit: 0, credit: totalPAYE },
        { accountId: ap._id,   accountCode: ap.code,   accountName: ap.name,   description: `NSSF payable ${period}`,   debit: 0, credit: totalNSSF },
        { accountId: ap._id,   accountCode: ap.code,   accountName: ap.name,   description: `SHIF payable ${period}`,   debit: 0, credit: totalSHIF },
        { accountId: ap._id,   accountCode: ap.code,   accountName: ap.name,   description: `Housing levy ${period}`,   debit: 0, credit: totalHousingLevy },
        { accountId: cash._id, accountCode: cash.code, accountName: cash.name, description: `Net salaries paid ${period}`, debit: 0, credit: totalNet }
      ], totalAmount: totalGross
    }).save();
    console.log(`[AutoAccounting] Payroll entry created for ${period}`);
  } catch (err) { console.error('[AutoAccounting] Payroll entry failed:', err.message); }
};
