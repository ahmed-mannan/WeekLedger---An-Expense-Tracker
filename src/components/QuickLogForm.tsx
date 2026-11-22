import React, { useEffect, useState } from 'react';
import { Calendar, Check } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  NewTransactionInput,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '../types/finance';
import {
  getTodayDateString,
  getWeekInfoForDate,
  mapCategoryToBucket,
} from '../lib/budgetMath';

interface QuickLogFormProps {
  currencySymbol: string;
  editingTransaction: Transaction | null;
  isSubmitting: boolean;
  onSubmitNew: (input: NewTransactionInput) => Promise<boolean>;
  onRequestEditConfirm: (
    existing: Transaction,
    updated: NewTransactionInput
  ) => void;
  onCancelEdit: () => void;
}

export function QuickLogForm({
  currencySymbol,
  editingTransaction,
  isSubmitting,
  onSubmitNew,
  onRequestEditConfirm,
  onCancelEdit,
}: QuickLogFormProps) {
  const [date, setDate] = useState<string>(getTodayDateString());
  const [type, setType] = useState<TransactionType>('Expense');
  const [category, setCategory] = useState<TransactionCategory>('Food');
  const [amountStr, setAmountStr] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState<boolean>(false);

  useEffect(() => {
    if (editingTransaction) {
      setDate(editingTransaction.date);
      setType(editingTransaction.type);
      setCategory(editingTransaction.category);
      setAmountStr(String(editingTransaction.amount));
      setNote(editingTransaction.note);
      setErrorMsg(null);
    }
  }, [editingTransaction]);

  const handleTypeSwitch = (nextType: TransactionType) => {
    setType(nextType);
    setErrorMsg(null);
    if (nextType === 'Expense') {
      if (!EXPENSE_CATEGORIES.includes(category as never)) {
        setCategory('Food');
      }
    } else {
      if (!INCOME_CATEGORIES.includes(category as never)) {
        setCategory('Home Allowance');
      }
    }
  };

  const handleAmountChange = (raw: string) => {
    const cleaned = raw.replace(/,/g, '').trim();
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setAmountStr(cleaned);
      if (errorMsg) setErrorMsg(null);
    }
  };

  const weekInfo = getWeekInfoForDate(date);
  const bucket = mapCategoryToBucket(type, category);
  const categoryOptions =
    type === 'Expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!date) {
      setErrorMsg('Please select a date.');
      return;
    }

    const numericAmount = Number(amountStr);
    if (!amountStr || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Enter an amount greater than 0.');
      return;
    }

    const payload: NewTransactionInput = {
      date,
      type,
      category,
      amount: numericAmount,
      note: note.trim(),
    };

    if (editingTransaction) {
      onRequestEditConfirm(editingTransaction, payload);
      return;
    }

    const ok = await onSubmitNew(payload);
    if (ok) {
      setAmountStr('');
      setNote('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  return (
    <section
      aria-labelledby="quick-log-heading"
      className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2
            id="quick-log-heading"
            className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {editingTransaction ? 'Edit Sheet Entry' : 'Log Entry'}
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Saves directly to your Google Sheet
          </p>
        </div>
        {editingTransaction && (
          <button
            type="button"
            onClick={() => {
              onCancelEdit();
              setAmountStr('');
              setNote('');
              setDate(getTodayDateString());
              setType('Expense');
              setCategory('Food');
            }}
            className="min-h-[40px] px-3 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel Edit
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        {/* Entry Type Toggle */}
        <div>
          <span className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Entry Type
          </span>
          <div
            role="group"
            aria-label="Entry type"
            className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl"
          >
            <button
              type="button"
              onClick={() => handleTypeSwitch('Expense')}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                type === 'Expense'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => handleTypeSwitch('Income')}
              className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                type === 'Income'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              Income
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date Picker + Auto-Week Readout */}
          <div>
            <label
              htmlFor="entry-date"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Date
            </label>
            <div className="relative">
              <Calendar
                className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="entry-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm tabular-nums text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
                required
              />
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                Week Num {weekInfo.weekNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{weekInfo.rangeLabel}</span>
            </div>
          </div>

          {/* Category / Income Source Dropdown */}
          <div>
            <label
              htmlFor="entry-category"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              {type === 'Expense' ? 'Expense Type' : 'Income Type'}
            </label>
            <select
              id="entry-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as TransactionCategory)
              }
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
            >
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              {type === 'Expense'
                ? `In-app rule: ${bucket} bucket`
                : category === 'Home Allowance'
                  ? 'Money taken from home'
                  : 'Salary in digital banking'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exact Amount Input */}
          <div>
            <label
              htmlFor="entry-amount"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              {type === 'Expense' ? 'Expense Amount' : 'Income Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-zinc-500 dark:text-zinc-400 pointer-events-none">
                {currencySymbol}
              </span>
              <input
                id="entry-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3.5 py-2 text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
                required
              />
            </div>
          </div>

          {/* Optional Note */}
          <div>
            <label
              htmlFor="entry-note"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Note{' '}
              <span className="text-zinc-400 dark:text-zinc-500 font-normal">
                (optional)
              </span>
            </label>
            <input
              id="entry-note"
              type="text"
              maxLength={140}
              placeholder={
                type === 'Expense'
                  ? 'e.g., Campus lunch, bus fare'
                  : 'e.g., Weekly allowance from home'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
            />
          </div>
        </div>

        {errorMsg && (
          <p
            role="alert"
            className="text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2"
          >
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[46px] px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950 active:scale-[0.99] rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          {isSubmitting ? (
            'Saving to Google Sheets...'
          ) : justSaved && !editingTransaction ? (
            <>
              <Check className="w-4 h-4" />
              <span>Saved to Google Sheet</span>
            </>
          ) : editingTransaction ? (
            'Review & Update Row'
          ) : (
            `Add ${type} to Sheet`
          )}
        </button>
      </form>
    </section>
  );
}
