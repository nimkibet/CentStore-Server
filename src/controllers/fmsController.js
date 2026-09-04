import Account from '../models/Account.js';
import JournalEntry from '../models/JournalEntry.js';
import AccountsPayable from '../models/AccountsPayable.js';
import AccountsReceivable from '../models/AccountsReceivable.js';

// Default Chart of Accounts seed data
const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash & Bank Balances', type: 'Asset', balance: 0, description: 'Primary liquid cash and bank account', isSystem: true },
  { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 0, description: 'Outstanding customer balances', isSystem: true },
  { code: '1200', name: 'Inventory Assets', type: 'Asset', balance: 0, description: 'Value of physical inventory on hand', isSystem: true },
  { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 0, description: 'Vendor bills and obligations', isSystem: true },
  { code: '3000', name: 'Owner\'s Equity', type: 'Equity', balance: 0, description: 'Owner capital investment', isSystem: true },
  { code: '4000', name: 'Sales Revenue', type: 'Revenue', balance: 0, description: 'Revenue earned from sales', isSystem: true },
  { code: '5000', name: 'Cost of Goods Sold (COGS)', type: 'Expense', balance: 0, description: 'Direct cost of inventory sold', isSystem: true },
  { code: '5100', name: 'Operating Expenses', type: 'Expense', balance: 0, description: 'General operational and administrative expenses', isSystem: true },
];

/**
 * Auto-seed default Chart of Accounts if empty and return all accounts.
 */
export const getAccounts = async (req, res) => {
  try {
    const count = await Account.countDocuments();
    if (count === 0) {
      console.log('Seeding initial default Chart of Accounts...');
      await Account.insertMany(DEFAULT_ACCOUNTS);
    }
    const accounts = await Account.find().sort({ code: 1 });
    res.status(200).json(accounts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts: ' + err.message });
  }
};

/**
 * Create a new account in Chart of Accounts.
 */
export const createAccount = async (req, res) => {
  try {
    const { code, name, type, description, balance } = req.body;
    if (!code || !name || !type) {
      res.status(400).json({ error: 'Account code, name, and type are required' });
      return;
    }

    const existing = await Account.findOne({ code: code.trim() });
    if (existing) {
      res.status(400).json({ error: `Account with code ${code} already exists` });
      return;
    }

    const newAccount = new Account({
      code: code.trim(),
      name: name.trim(),
      type,
      description: description ? description.trim() : '',
      balance: typeof balance === 'number' ? balance : 0,
      isSystem: false,
    });

    await newAccount.save();
    res.status(201).json(newAccount);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account: ' + err.message });
  }
};

/**
 * Create a new Journal Entry.
 * Validates lines.length >= 2 and sumDebits === sumCredits.
 * Returns 400 Bad Request if unbalanced.
 * Updates target Account balances on posting.
 */
export const createJournalEntry = async (req, res) => {
  try {
    const { entryNumber, date, description, reference, lines, status } = req.body;

    if (!lines || !Array.isArray(lines) || lines.length < 2) {
      res.status(400).json({ error: 'Journal entry must contain at least 2 lines' });
      return;
    }

    const sumDebits = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
    const sumCredits = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);

    if (Math.abs(sumDebits - sumCredits) >= 0.001) {
      res.status(400).json({
        error: `Journal entry is unbalanced: Total debits ($${sumDebits}) must equal total credits ($${sumCredits})`,
      });
      return;
    }

    // Enrich line items with account details if missing
    const enrichedLines = await Promise.all(
      lines.map(async (line) => {
        let accountCode = line.accountCode;
        let accountName = line.accountName;
        if (line.accountId && (!accountCode || !accountName)) {
          const acc = await Account.findById(line.accountId);
          if (acc) {
            accountCode = acc.code;
            accountName = acc.name;
          }
        }
        return {
          accountId: line.accountId,
          accountCode: accountCode || '',
          accountName: accountName || '',
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description || '',
        };
      })
    );

    const generatedNumber = entryNumber ? entryNumber.trim() : `JE-${Date.now()}`;

    const journalEntry = new JournalEntry({
      entryNumber: generatedNumber,
      date: date ? new Date(date) : new Date(),
      description: description ? description.trim() : 'Journal Entry',
      reference: reference ? reference.trim() : '',
      lines: enrichedLines,
      createdBy: req.staff?._id,
      status: status || 'posted',
    });

    await journalEntry.save();

    // If posted, update target Account balances
    if (journalEntry.status === 'posted') {
      for (const line of enrichedLines) {
        const account = await Account.findById(line.accountId);
        if (account) {
          if (account.type === 'Asset' || account.type === 'Expense') {
            account.balance += line.debit - line.credit;
          } else if (account.type === 'Liability' || account.type === 'Equity' || account.type === 'Revenue') {
            account.balance += line.credit - line.debit;
          }
          await account.save();
        }
      }
    }

    res.status(201).json(journalEntry);
  } catch (err) {
    if (err.name === 'ValidationError') {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to create journal entry: ' + err.message });
  }
};

/**
 * Get all journal entries populated with account details.
 */
export const getJournalEntries = async (req, res) => {
  try {
    const entries = await JournalEntry.find()
      .populate('lines.accountId', 'code name type')
      .populate('createdBy', 'name email')
      .sort({ date: -1, createdAt: -1 });
    res.status(200).json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch journal entries: ' + err.message });
  }
};

/**
 * Accounts Payable Controllers
 */
export const getAPInvoices = async (req, res) => {
  try {
    const bills = await AccountsPayable.find().sort({ dueDate: 1, createdAt: -1 });
    res.status(200).json(bills);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Accounts Payable bills: ' + err.message });
  }
};

export const createAPInvoice = async (req, res) => {
  try {
    const { vendorName, billNumber, amount, dueDate, issueDate, description, notes, vendorId } = req.body;
    if (!vendorName || !amount || !dueDate) {
      res.status(400).json({ error: 'Vendor name, bill amount, and due date are required' });
      return;
    }

    const genBillNum = billNumber ? billNumber.trim() : `BILL-${Date.now()}`;

    const bill = new AccountsPayable({
      vendorId: vendorId || undefined,
      vendorName: vendorName.trim(),
      billNumber: genBillNum,
      amount: Number(amount),
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(dueDate),
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      description: description ? description.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    await bill.save();
    res.status(201).json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create AP bill: ' + err.message });
  }
};

export const updateAPStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, paidAmount, status } = req.body;

    const bill = await AccountsPayable.findById(id);
    if (!bill) {
      res.status(404).json({ error: 'AP bill not found' });
      return;
    }

    if (typeof paymentAmount === 'number' && paymentAmount > 0) {
      bill.paidAmount += paymentAmount;
    } else if (typeof paidAmount === 'number') {
      bill.paidAmount = paidAmount;
    }

    if (status) {
      bill.status = status;
    } else {
      if (bill.paidAmount >= bill.amount) {
        bill.status = 'paid';
      } else if (bill.paidAmount > 0) {
        bill.status = 'partially_paid';
      } else {
        bill.status = 'unpaid';
      }
    }

    await bill.save();
    res.status(200).json(bill);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AP status: ' + err.message });
  }
};

/**
 * Accounts Receivable Controllers
 */
export const getARInvoices = async (req, res) => {
  try {
    const invoices = await AccountsReceivable.find().sort({ dueDate: 1, createdAt: -1 });
    res.status(200).json(invoices);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch Accounts Receivable invoices: ' + err.message });
  }
};

export const createARInvoice = async (req, res) => {
  try {
    const { customerName, invoiceNumber, amount, dueDate, issueDate, description, notes, customerId } = req.body;
    if (!customerName || !amount || !dueDate) {
      res.status(400).json({ error: 'Customer name, invoice amount, and due date are required' });
      return;
    }

    const genInvNum = invoiceNumber ? invoiceNumber.trim() : `INV-${Date.now()}`;

    const invoice = new AccountsReceivable({
      customerId: customerId || undefined,
      customerName: customerName.trim(),
      invoiceNumber: genInvNum,
      amount: Number(amount),
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date(dueDate),
      issueDate: issueDate ? new Date(issueDate) : new Date(),
      description: description ? description.trim() : '',
      notes: notes ? notes.trim() : '',
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create AR invoice: ' + err.message });
  }
};

export const updateARStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount, paidAmount, status } = req.body;

    const invoice = await AccountsReceivable.findById(id);
    if (!invoice) {
      res.status(404).json({ error: 'AR invoice not found' });
      return;
    }

    if (typeof paymentAmount === 'number' && paymentAmount > 0) {
      invoice.paidAmount += paymentAmount;
    } else if (typeof paidAmount === 'number') {
      invoice.paidAmount = paidAmount;
    }

    if (status) {
      invoice.status = status;
    } else {
      if (invoice.paidAmount >= invoice.amount) {
        invoice.status = 'paid';
      } else if (invoice.paidAmount > 0) {
        invoice.status = 'partially_paid';
      } else {
        invoice.status = 'unpaid';
      }
    }

    await invoice.save();
    res.status(200).json(invoice);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AR status: ' + err.message });
  }
};

/**
 * Generate Financial Reports (P&L, Balance Sheet, Cash Flow)
 */
export const getFinancialReports = async (req, res) => {
  try {
    // Seed default accounts if needed
    const count = await Account.countDocuments();
    if (count === 0) {
      await Account.insertMany(DEFAULT_ACCOUNTS);
    }

    const accounts = await Account.find();

    // Group balances by account type
    let totalRevenue = 0;
    let totalExpenses = 0;
    let cogs = 0;
    let operatingExpenses = 0;

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const revenueAccounts = [];
    const expenseAccounts = [];
    const assetAccounts = [];
    const liabilityAccounts = [];
    const equityAccounts = [];

    accounts.forEach((acc) => {
      const item = { code: acc.code, name: acc.name, balance: acc.balance };
      if (acc.type === 'Revenue') {
        totalRevenue += acc.balance;
        revenueAccounts.push(item);
      } else if (acc.type === 'Expense') {
        totalExpenses += acc.balance;
        expenseAccounts.push(item);
        if (acc.code === '5000' || acc.name.toLowerCase().includes('cogs') || acc.name.toLowerCase().includes('cost of goods')) {
          cogs += acc.balance;
        } else {
          operatingExpenses += acc.balance;
        }
      } else if (acc.type === 'Asset') {
        totalAssets += acc.balance;
        assetAccounts.push(item);
      } else if (acc.type === 'Liability') {
        totalLiabilities += acc.balance;
        liabilityAccounts.push(item);
      } else if (acc.type === 'Equity') {
        totalEquity += acc.balance;
        equityAccounts.push(item);
      }
    });

    const grossProfit = totalRevenue - cogs;
    const netProfit = totalRevenue - totalExpenses;

    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;
    const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

    // Cash flow metrics
    const cashAcc = accounts.find((a) => a.code === '1000');
    const endingCash = cashAcc ? cashAcc.balance : 0;
    const apTotal = accounts.find((a) => a.code === '2000')?.balance || 0;
    const arTotal = accounts.find((a) => a.code === '1100')?.balance || 0;

    const operatingCashFlow = netProfit + apTotal - arTotal;
    const investingCashFlow = 0;
    const financingCashFlow = 0;
    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
    const beginningCash = endingCash - netCashFlow;

    res.status(200).json({
      profitAndLoss: {
        totalRevenue,
        cogs,
        grossProfit,
        operatingExpenses,
        totalExpenses,
        netProfit,
        revenueAccounts,
        expenseAccounts,
      },
      balanceSheet: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        netIncome: netProfit,
        totalLiabilitiesAndEquity,
        isBalanced,
        assetAccounts,
        liabilityAccounts,
        equityAccounts,
      },
      cashFlow: {
        operatingCashFlow,
        investingCashFlow,
        financingCashFlow,
        netCashFlow,
        beginningCash,
        endingCash,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate financial reports: ' + err.message });
  }
};
