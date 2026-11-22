import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MonthlySummary, formatCurrency } from '../lib/budgetMath';

interface MonthlySummarySectionProps {
  summary: MonthlySummary;
  currencySymbol: string;
  onChangeMonth: (delta: number) => void;
}

export function MonthlySummarySection({
  summary,
  currencySymbol,
  onChangeMonth,
}: MonthlySummarySectionProps) {
  const {
    monthLabel,
    monthIncome,
    monthHomeAllowance,
    monthDigitalSalary,
    monthExpenses,
    monthNetBalance,
    weeklyRollups,
    categoryRollups,
  } = summary;

  return (
    <section
      aria-labelledby="monthly-summary-heading"
      className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-5"
    >
      {/* Header + Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            id="monthly-summary-heading"
            className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            Monthly Summary
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Select any month to inspect income, weekly spend, and category
            totals
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onChangeMonth(-1)}
            aria-label="Previous month"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[140px] text-center text-sm font-semibold text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => onChangeMonth(1)}
            aria-label="Next month"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3 Basic Useful Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Monthly Income
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatCurrency(monthIncome, currencySymbol)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            Home {formatCurrency(monthHomeAllowance, currencySymbol)} · Bank{' '}
            {formatCurrency(monthDigitalSalary, currencySymbol)}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Monthly Spend
          </span>
          <div className="mt-1 text-xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatCurrency(monthExpenses, currencySymbol)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
            Needs {formatCurrency(summary.monthNeedsSpend, currencySymbol)} ·
            Wants {formatCurrency(summary.monthWantsSpend, currencySymbol)}
          </div>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50/50 dark:bg-zinc-900/40">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Remaining Balance
          </span>
          <div
            className={`mt-1 text-xl font-bold tracking-tight tabular-nums ${
              monthNetBalance < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-zinc-900 dark:text-zinc-50'
            }`}
          >
            {formatCurrency(monthNetBalance, currencySymbol)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {monthNetBalance >= 0
              ? 'Net saved this month'
              : 'Expenses exceed income'}
          </div>
        </div>
      </div>

      {/* Weekly Breakdown + Category Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 min-w-0">
        <div className="lg:col-span-7 min-w-0">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2.5">
            Week-by-Week ({monthLabel})
          </h3>
          <div className="w-full min-w-0 overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 text-xs border-b border-zinc-200 dark:border-zinc-800">
                  <th className="py-2.5 px-3 font-medium">Week</th>
                  <th className="py-2.5 px-3 font-medium text-right">Income</th>
                  <th className="py-2.5 px-3 font-medium text-right">Spent</th>
                  <th className="py-2.5 px-3 font-medium text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 tabular-nums">
                {weeklyRollups.map((w) => (
                  <tr key={w.weekNumber}>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {w.weekLabel}
                      </span>{' '}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        ({w.rangeLabel})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-600 dark:text-zinc-400">
                      {w.income > 0
                        ? formatCurrency(w.income, currencySymbol)
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-zinc-900 dark:text-zinc-100 font-medium">
                      {w.totalSpend > 0
                        ? formatCurrency(w.totalSpend, currencySymbol)
                        : '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-medium ${
                        w.net < 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : w.net > 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-zinc-400 dark:text-zinc-600'
                      }`}
                    >
                      {w.income === 0 && w.totalSpend === 0
                        ? '—'
                        : formatCurrency(w.net, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-5">
          <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2.5">
            Spending by Category
          </h3>
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800/80">
            {categoryRollups.map((cat) => (
              <div
                key={cat.category}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {cat.category}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {cat.bucket}
                  </span>
                </div>
                <div className="tabular-nums text-right">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatCurrency(cat.amount, currencySymbol)}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {cat.pctOfSpend.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
