import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { BudgetRatio, DEFAULT_BUDGET_RATIO } from '../types/finance';
import { MonthlySummary, formatCurrency } from '../lib/budgetMath';

interface BudgetRuleSectionProps {
  summary: MonthlySummary;
  currencySymbol: string;
  ratio: BudgetRatio;
  onChangeRatio: (next: BudgetRatio) => void;
}

interface PieSlice {
  label: 'Needs' | 'Wants' | 'Savings';
  value: number;
  pct: number;
  colorClass: string;
  strokeHex: string;
}

export function BudgetRuleSection({
  summary,
  currencySymbol,
  ratio,
  onChangeRatio,
}: BudgetRuleSectionProps) {
  const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);

  const {
    monthIncome,
    monthExpenses,
    monthNeedsSpend,
    monthWantsSpend,
    monthNetBalance,
    allocationRows,
    hasIncome,
  } = summary;

  const clampPct = (val: number) => Math.max(0, Math.min(100, Math.round(val)));

  const handleFieldChange = (
    field: keyof BudgetRatio,
    rawValue: string
  ) => {
    const cleaned = rawValue.replace(/[^0-9]/g, '');
    const num = cleaned === '' ? 0 : clampPct(Number(cleaned));

    if (field === 'needs') {
      const nextNeeds = num;
      const remaining = Math.max(0, 100 - nextNeeds);
      const nextWants = Math.min(ratio.wants, remaining);
      const nextSavings = Math.max(0, 100 - nextNeeds - nextWants);
      onChangeRatio({ needs: nextNeeds, wants: nextWants, savings: nextSavings });
    } else if (field === 'wants') {
      const maxWants = Math.max(0, 100 - ratio.needs);
      const nextWants = Math.min(num, maxWants);
      const nextSavings = Math.max(0, 100 - ratio.needs - nextWants);
      onChangeRatio({ needs: ratio.needs, wants: nextWants, savings: nextSavings });
    } else {
      const maxSavings = Math.max(0, 100 - ratio.needs);
      const nextSavings = Math.min(num, maxSavings);
      const nextWants = Math.max(0, 100 - ratio.needs - nextSavings);
      onChangeRatio({ needs: ratio.needs, wants: nextWants, savings: nextSavings });
    }
  };

  const isCustomRatio =
    ratio.needs !== DEFAULT_BUDGET_RATIO.needs ||
    ratio.wants !== DEFAULT_BUDGET_RATIO.wants ||
    ratio.savings !== DEFAULT_BUDGET_RATIO.savings;

  const savingsForChart = Math.max(0, monthNetBalance);
  const chartTotal = hasIncome
    ? Math.max(1, monthNeedsSpend + monthWantsSpend + savingsForChart)
    : Math.max(1, monthExpenses);

  // Cohesive modern fintech palette: Cobalt Blue (Needs), Amber (Wants), Emerald (Savings)
  const slices: PieSlice[] = hasIncome
    ? [
        {
          label: 'Needs',
          value: monthNeedsSpend,
          pct: (monthNeedsSpend / chartTotal) * 100,
          colorClass: 'bg-blue-600 dark:bg-blue-500',
          strokeHex: '#2563EB',
        },
        {
          label: 'Wants',
          value: monthWantsSpend,
          pct: (monthWantsSpend / chartTotal) * 100,
          colorClass: 'bg-amber-500 dark:bg-amber-400',
          strokeHex: '#D97706',
        },
        {
          label: 'Savings',
          value: savingsForChart,
          pct: (savingsForChart / chartTotal) * 100,
          colorClass: 'bg-emerald-600 dark:bg-emerald-500',
          strokeHex: '#059669',
        },
      ]
    : [
        {
          label: 'Needs',
          value: monthNeedsSpend,
          pct: monthExpenses > 0 ? (monthNeedsSpend / chartTotal) * 100 : 0,
          colorClass: 'bg-blue-600 dark:bg-blue-500',
          strokeHex: '#2563EB',
        },
        {
          label: 'Wants',
          value: monthWantsSpend,
          pct: monthExpenses > 0 ? (monthWantsSpend / chartTotal) * 100 : 0,
          colorClass: 'bg-amber-500 dark:bg-amber-400',
          strokeHex: '#D97706',
        },
        {
          label: 'Savings',
          value: 0,
          pct: 0,
          colorClass: 'bg-emerald-600 dark:bg-emerald-500',
          strokeHex: '#059669',
        },
      ];

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let cumulativePct = 0;
  const hasAnyChartData = monthIncome > 0 || monthExpenses > 0;

  const totalTargetBudget = monthIncome;
  const totalAllocatedActual = allocationRows.reduce(
    (sum, r) => sum + r.actualAmount,
    0
  );
  const totalActualPct = hasIncome
    ? (totalAllocatedActual / monthIncome) * 100
    : 0;
  const totalDifference = totalTargetBudget - totalAllocatedActual;

  return (
    <section
      aria-labelledby="budget-rule-heading"
      className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 space-y-6"
    >
      {/* Header + Editable Ratio Inputs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2
            id="budget-rule-heading"
            className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50"
          >
            {ratio.needs} / {ratio.wants} / {ratio.savings} Budget Allocation
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {summary.monthLabel} · Calculated in-app only (not stored in Google
            Sheets)
          </p>
        </div>

        {/* Editable Ratio Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1.5">
            <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <span>Needs</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Needs target percentage"
                value={ratio.needs}
                onChange={(e) => handleFieldChange('needs', e.target.value)}
                className="w-10 h-7 text-center font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
              <span>%</span>
            </label>

            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
              /
            </span>

            <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <span>Wants</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Wants target percentage"
                value={ratio.wants}
                onChange={(e) => handleFieldChange('wants', e.target.value)}
                className="w-10 h-7 text-center font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
              <span>%</span>
            </label>

            <span className="text-zinc-300 dark:text-zinc-700" aria-hidden="true">
              /
            </span>

            <label className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-600 dark:text-zinc-300">
              <span>Savings</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Savings target percentage"
                value={ratio.savings}
                onChange={(e) => handleFieldChange('savings', e.target.value)}
                className="w-10 h-7 text-center font-semibold tabular-nums text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
              />
              <span>%</span>
            </label>
          </div>

          {isCustomRatio && (
            <button
              type="button"
              onClick={() => onChangeRatio(DEFAULT_BUDGET_RATIO)}
              title="Reset to 50 / 30 / 20"
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset 50/30/20</span>
            </button>
          )}
        </div>
      </div>

      {/* Pie Chart + Slice Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg
              viewBox="0 0 180 180"
              className="w-full h-full -rotate-90"
              role="img"
              aria-label="Pie chart of Needs, Wants, and Savings allocation"
            >
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                className="stroke-zinc-100 dark:stroke-zinc-800"
                strokeWidth="26"
              />
              {hasAnyChartData &&
                slices.map((slice) => {
                  if (slice.pct <= 0) return null;
                  const segLength = (slice.pct / 100) * circumference;
                  const dashOffset = -(cumulativePct / 100) * circumference;
                  cumulativePct += slice.pct;
                  const isHovered = hoveredSlice === slice.label;

                  return (
                    <circle
                      key={slice.label}
                      cx="90"
                      cy="90"
                      r={radius}
                      fill="none"
                      stroke={slice.strokeHex}
                      strokeWidth={isHovered ? 30 : 26}
                      strokeDasharray={`${segLength} ${circumference}`}
                      strokeDashoffset={dashOffset}
                      className="transition-all duration-150 cursor-pointer"
                      onMouseEnter={() => setHoveredSlice(slice.label)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {hoveredSlice
                  ? hoveredSlice
                  : hasIncome
                    ? 'Income'
                    : 'Total Spent'}
              </span>
              <span className="text-lg font-bold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50 mt-0.5">
                {hoveredSlice
                  ? formatCurrency(
                      slices.find((s) => s.label === hoveredSlice)?.value ?? 0,
                      currencySymbol
                    )
                  : formatCurrency(
                      hasIncome ? monthIncome : monthExpenses,
                      currencySymbol
                    )}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-7 space-y-2.5">
          {slices.map((slice, index) => {
            const targetRow = allocationRows[index];
            return (
              <div
                key={slice.label}
                onMouseEnter={() => setHoveredSlice(slice.label)}
                onMouseLeave={() => setHoveredSlice(null)}
                className="flex items-center justify-between gap-4 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-3 h-3 rounded-xs shrink-0 ${slice.colorClass}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {slice.label}{' '}
                      <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        ({targetRow.targetPct}% goal)
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {slice.label === 'Needs'
                        ? 'Food, Travel, Needs'
                        : slice.label === 'Wants'
                          ? 'Wants, Others'
                          : 'Remaining unspent income'}
                    </div>
                  </div>
                </div>
                <div className="text-right tabular-nums shrink-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(slice.value, currencySymbol)}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {hasIncome
                      ? `${targetRow.actualPct.toFixed(1)}% of income`
                      : monthExpenses > 0
                        ? `${slice.pct.toFixed(1)}% of spend`
                        : '0.0%'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Budget Allocation & Actuals Table */}
      <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-50 text-xs font-semibold tracking-wide px-4 py-2.5 flex items-center justify-between border-b border-zinc-800">
          <span>
            {ratio.needs} / {ratio.wants} / {ratio.savings} Budget Allocation &amp; Actuals
          </span>
          <span className="text-zinc-400 font-normal">In-App Calculation</span>
        </div>
        <table className="w-full text-left border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 text-xs border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2.5 px-3.5 font-medium">Category</th>
              <th className="py-2.5 px-3.5 font-medium text-right">Target %</th>
              <th className="py-2.5 px-3.5 font-medium text-right">
                Target Budget
              </th>
              <th className="py-2.5 px-3.5 font-medium text-right">
                Actual Spend
              </th>
              <th className="py-2.5 px-3.5 font-medium text-right">Actual %</th>
              <th className="py-2.5 px-3.5 font-medium text-right">
                Difference
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 tabular-nums">
            {allocationRows.map((row) => {
              const dotClass =
                row.label === 'Needs'
                  ? 'bg-blue-600 dark:bg-blue-500'
                  : row.label === 'Wants'
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-emerald-600 dark:bg-emerald-500';
              const isOver =
                row.label === 'Savings'
                  ? row.actualAmount < row.targetBudget && hasIncome
                  : row.difference < 0;

              return (
                <tr
                  key={row.label}
                  className="bg-white dark:bg-[#111113] hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40 transition-colors"
                >
                  <td className="py-3 px-3.5 font-semibold text-zinc-900 dark:text-zinc-50">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-xs ${dotClass}`}
                        aria-hidden="true"
                      />
                      <span>{row.label}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right text-zinc-600 dark:text-zinc-400">
                    {row.targetPct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3.5 text-right text-zinc-700 dark:text-zinc-300">
                    {formatCurrency(row.targetBudget, currencySymbol)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(row.actualAmount, currencySymbol)}
                  </td>
                  <td className="py-3 px-3.5 text-right text-zinc-700 dark:text-zinc-300">
                    {hasIncome ? `${row.actualPct.toFixed(1)}%` : '—'}
                  </td>
                  <td
                    className={`py-3 px-3.5 text-right font-medium ${
                      isOver
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatCurrency(row.difference, currencySymbol)}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-zinc-50 dark:bg-zinc-900/70 font-semibold text-zinc-900 dark:text-zinc-50">
              <td className="py-3 px-3.5">Total</td>
              <td className="py-3 px-3.5 text-right">100.0%</td>
              <td className="py-3 px-3.5 text-right">
                {formatCurrency(totalTargetBudget, currencySymbol)}
              </td>
              <td className="py-3 px-3.5 text-right">
                {formatCurrency(totalAllocatedActual, currencySymbol)}
              </td>
              <td className="py-3 px-3.5 text-right">
                {hasIncome ? `${totalActualPct.toFixed(1)}%` : '—'}
              </td>
              <td className="py-3 px-3.5 text-right">
                {formatCurrency(totalDifference, currencySymbol)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
