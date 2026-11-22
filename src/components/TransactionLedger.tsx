import { useMemo, useState } from 'react';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { Transaction } from '../types/finance';
import { formatCurrency, formatDateShort } from '../lib/budgetMath';

interface TransactionLedgerProps {
  transactions: Transaction[];
  currencySymbol: string;
  isLoading: boolean;
  onEdit: (tx: Transaction) => void;
  onRequestDelete: (tx: Transaction) => void;
  onGoToDashboard?: () => void;
}

export function TransactionLedger({
  transactions,
  currencySymbol,
  isLoading,
  onEdit,
  onRequestDelete,
  onGoToDashboard,
}: TransactionLedgerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Expense' | 'Income'>(
    'All'
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== 'All' && tx.type !== typeFilter) return false;
      if (q) {
        const haystack =
          `${tx.category} ${tx.note} ${tx.week} ${tx.date}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, typeFilter, searchQuery]);

  return (
    <section
      aria-labelledby="ledger-heading"
      className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            id="ledger-heading"
            className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Transaction History
          </h1>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            {filteredTransactions.length}{' '}
            {filteredTransactions.length === 1 ? 'entry' : 'entries'} from
            Google Sheets
          </p>
        </div>

        <div
          role="group"
          aria-label="Filter by entry type"
          className="inline-flex items-center p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl self-start sm:self-auto"
        >
          {(['All', 'Expense', 'Income'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setTypeFilter(tab)}
              className={`min-h-[38px] px-3 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                typeFilter === tab
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {tab === 'Expense' ? 'Expenses' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="mt-4 relative">
        <Search
          className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by date, category, week, or note..."
          aria-label="Search transaction history"
          className="w-full min-h-[44px] pl-10 pr-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
        />
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div
          className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800"
          aria-busy="true"
        >
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="py-3.5 flex items-center justify-between gap-4 animate-pulse"
            >
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-3 w-52 bg-zinc-100 dark:bg-zinc-900 rounded" />
              </div>
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-6 py-10 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No entries recorded yet
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            Your logged income and expenses will appear here chronologically.
          </p>
          {onGoToDashboard && (
            <button
              type="button"
              onClick={onGoToDashboard}
              className="mt-4 min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950 rounded-xl transition-colors whitespace-nowrap"
            >
              Back to Dashboard
            </button>
          )}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="mt-6 py-8 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            No matching entries
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setTypeFilter('All');
            }}
            className="mt-3 min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {filteredTransactions.map((tx) => {
            const isIncome = tx.type === 'Income';
            return (
              <div
                key={tx.id}
                className="py-3.5 flex items-center justify-between gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 -mx-2 px-2 rounded-xl transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {tx.category}
                    </span>
                    {tx.note && (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        — {tx.note}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    <span>{tx.date}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDateShort(tx.date)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Week {tx.weekNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span>{tx.type}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <span
                    className={`text-sm font-semibold tabular-nums mr-1 ${
                      isIncome
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    {isIncome ? '+' : '-'}
                    {formatCurrency(tx.amount, currencySymbol)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onEdit(tx)}
                    aria-label={`Edit ${tx.category} entry from ${tx.date}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onRequestDelete(tx)}
                    aria-label={`Delete ${tx.category} entry from ${tx.date}`}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors focus-visible:outline-2 focus-visible:outline-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
