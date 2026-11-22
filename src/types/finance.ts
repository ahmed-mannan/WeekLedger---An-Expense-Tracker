export type TransactionType = 'Expense' | 'Income';

export type ExpenseCategory = 'Needs' | 'Food' | 'Travel' | 'Wants' | 'Others';
export type IncomeCategory = 'Home Allowance' | 'Digital Bank Salary';
export type TransactionCategory = ExpenseCategory | IncomeCategory;
export type BudgetBucket = 'Needs' | 'Wants' | 'Income';
export type SheetSchemaVersion = 'v2-8col' | 'v1-10col';

export interface BudgetRatio {
  needs: number;
  wants: number;
  savings: number;
}

export const DEFAULT_BUDGET_RATIO: BudgetRatio = {
  needs: 50,
  wants: 30,
  savings: 20,
};

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Travel',
  'Needs',
  'Wants',
  'Others',
];

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'Home Allowance',
  'Digital Bank Salary',
];

export interface Transaction {
  id: string;
  rowNumber: number; // 1-based row index in Google Sheet (2+)
  date: string; // YYYY-MM-DD
  month: string; // Derived YYYY-MM from date
  week: string; // Derived "Week 4"
  weekNumber: number; // Stored in sheet "Week Num" column
  type: TransactionType;
  category: TransactionCategory;
  bucket: BudgetBucket; // Derived in-app for custom budget ratio
  amount: number;
  note: string;
}

export interface NewTransactionInput {
  date: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  note: string;
}

export interface AppSettings {
  currencyCode: string;
  currencySymbol: string;
}

export interface CurrencyPreset {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka (৳)' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'PKR', symbol: '₨', label: 'Pakistani Rupee (₨)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit (RM)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
];

export interface SheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  transactionsSheetId: number;
  schemaVersion: SheetSchemaVersion;
}
