import {
  BudgetBucket,
  BudgetRatio,
  DEFAULT_BUDGET_RATIO,
  ExpenseCategory,
  EXPENSE_CATEGORIES,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '../types/finance';

export interface WeekInfo {
  weekNumber: number;
  weekLabel: string; // "Week 1"
  shortLabel: string; // "W1"
  startDay: number;
  endDay: number;
  rangeLabel: string; // "Nov 1 – Nov 7"
  yearMonth: string; // "YYYY-MM"
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentYearMonth(): string {
  return getTodayDateString().slice(0, 7);
}

export function parseDateParts(dateStr: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(dateStr.trim());
  if (!match) {
    const fallback = new Date();
    return {
      year: fallback.getFullYear(),
      month: fallback.getMonth() + 1,
      day: fallback.getDate(),
    };
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Computes Sunday-start calendar week of the month for any YYYY-MM-DD date.
 */
export function getWeekInfoForDate(dateStr: string): WeekInfo {
  const { year, month, day } = parseDateParts(dateStr);
  const daysInMonth = getDaysInMonth(year, month);
  const clampedDay = Math.min(Math.max(1, day), daysInMonth);
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const weekNumber = Math.ceil((clampedDay + firstWeekday) / 7);
  const startDay = Math.max(1, (weekNumber - 1) * 7 - firstWeekday + 1);
  const endDay = Math.min(daysInMonth, weekNumber * 7 - firstWeekday);
  const shortMonth = SHORT_MONTHS[month - 1] ?? '';

  return {
    weekNumber,
    weekLabel: `Week ${weekNumber}`,
    shortLabel: `W${weekNumber}`,
    startDay,
    endDay,
    rangeLabel:
      startDay === endDay
        ? `${shortMonth} ${startDay}`
        : `${shortMonth} ${startDay} – ${shortMonth} ${endDay}`,
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * Lists all Sunday-start calendar weeks in a YYYY-MM month.
 */
export function getWeeksInMonth(yearMonth: string): WeekInfo[] {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const daysInMonth = getDaysInMonth(year, month);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const totalWeeks = Math.ceil((daysInMonth + firstWeekday) / 7);
  const shortMonth = SHORT_MONTHS[month - 1] ?? '';

  const weeks: WeekInfo[] = [];
  for (let w = 1; w <= totalWeeks; w++) {
    const startDay = Math.max(1, (w - 1) * 7 - firstWeekday + 1);
    const endDay = Math.min(daysInMonth, w * 7 - firstWeekday);
    weeks.push({
      weekNumber: w,
      weekLabel: `Week ${w}`,
      shortLabel: `W${w}`,
      startDay,
      endDay,
      rangeLabel:
        startDay === endDay
          ? `${shortMonth} ${startDay}`
          : `${shortMonth} ${startDay} – ${shortMonth} ${endDay}`,
      yearMonth,
    });
  }
  return weeks;
}

export function formatMonthLabel(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  if (!year || !month) return yearMonth;
  return `${FULL_MONTHS[month - 1]} ${year}`;
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split('-');
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const d = new Date(year, month - 1 + deltaMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Maps categories into Needs vs Wants buckets:
 * Food, Travel, and Needs -> Needs
 * Wants and Others -> Wants
 * Income -> Income
 */
export function mapCategoryToBucket(
  type: TransactionType,
  category: TransactionCategory | string
): BudgetBucket {
  if (type === 'Income') return 'Income';
  if (category === 'Needs' || category === 'Food' || category === 'Travel') {
    return 'Needs';
  }
  return 'Wants';
}

export function formatCurrency(amount: number, symbol: string): string {
  const abs = Math.abs(amount);
  const hasDecimals = Math.round(abs * 100) % 100 !== 0;
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function formatDateShort(dateStr: string): string {
  const { month, day } = parseDateParts(dateStr);
  return `${SHORT_MONTHS[month - 1] ?? ''} ${day}`;
}

export interface AllocationRow {
  label: 'Needs' | 'Wants' | 'Savings';
  targetPct: number;
  targetBudget: number;
  actualAmount: number;
  actualPct: number;
  difference: number; // targetBudget - actualAmount
}

export interface WeeklyRollup {
  weekNumber: number;
  weekLabel: string;
  rangeLabel: string;
  income: number;
  homeAllowance: number;
  digitalSalary: number;
  needsSpend: number;
  wantsSpend: number;
  totalSpend: number;
  net: number;
}

export interface CategoryRollup {
  category: ExpenseCategory;
  bucket: 'Needs' | 'Wants';
  amount: number;
  pctOfSpend: number;
}

export interface MonthlySummary {
  yearMonth: string;
  monthLabel: string;
  weeks: WeekInfo[];
  weeklyRollups: WeeklyRollup[];
  monthIncome: number;
  monthHomeAllowance: number;
  monthDigitalSalary: number;
  monthExpenses: number;
  monthNetBalance: number;
  monthNeedsSpend: number;
  monthWantsSpend: number;
  categoryRollups: CategoryRollup[];
  allocationRows: AllocationRow[];
  hasIncome: boolean;
  ratio: BudgetRatio;
}

export function computeMonthlySummary(
  transactions: Transaction[],
  yearMonth: string,
  ratio: BudgetRatio = DEFAULT_BUDGET_RATIO
): MonthlySummary {
  const weeks = getWeeksInMonth(yearMonth);
  const monthTx = transactions.filter((t) => t.month === yearMonth);

  let monthIncome = 0;
  let monthHomeAllowance = 0;
  let monthDigitalSalary = 0;
  let monthExpenses = 0;
  let monthNeedsSpend = 0;
  let monthWantsSpend = 0;

  const weekMap = new Map<number, WeeklyRollup>();
  for (const w of weeks) {
    weekMap.set(w.weekNumber, {
      weekNumber: w.weekNumber,
      weekLabel: w.weekLabel,
      rangeLabel: w.rangeLabel,
      income: 0,
      homeAllowance: 0,
      digitalSalary: 0,
      needsSpend: 0,
      wantsSpend: 0,
      totalSpend: 0,
      net: 0,
    });
  }

  const catTotals: Record<ExpenseCategory, number> = {
    Food: 0,
    Travel: 0,
    Needs: 0,
    Wants: 0,
    Others: 0,
  };

  for (const tx of monthTx) {
    const wRollup = weekMap.get(tx.weekNumber);
    if (tx.type === 'Income') {
      monthIncome += tx.amount;
      if (tx.category === 'Home Allowance') {
        monthHomeAllowance += tx.amount;
        if (wRollup) wRollup.homeAllowance += tx.amount;
      } else {
        monthDigitalSalary += tx.amount;
        if (wRollup) wRollup.digitalSalary += tx.amount;
      }
      if (wRollup) wRollup.income += tx.amount;
    } else {
      monthExpenses += tx.amount;
      const bucket = mapCategoryToBucket(tx.type, tx.category);
      if (bucket === 'Needs') {
        monthNeedsSpend += tx.amount;
        if (wRollup) wRollup.needsSpend += tx.amount;
      } else {
        monthWantsSpend += tx.amount;
        if (wRollup) wRollup.wantsSpend += tx.amount;
      }
      if (wRollup) wRollup.totalSpend += tx.amount;

      if (EXPENSE_CATEGORIES.includes(tx.category as ExpenseCategory)) {
        catTotals[tx.category as ExpenseCategory] += tx.amount;
      } else {
        catTotals.Others += tx.amount;
      }
    }
  }

  const weeklyRollups = Array.from(weekMap.values()).map((w) => ({
    ...w,
    net: w.income - w.totalSpend,
  }));

  const categoryRollups: CategoryRollup[] = EXPENSE_CATEGORIES.map((cat) => {
    const bucket: 'Needs' | 'Wants' =
      mapCategoryToBucket('Expense', cat) === 'Needs' ? 'Needs' : 'Wants';
    return {
      category: cat,
      bucket,
      amount: catTotals[cat],
      pctOfSpend: monthExpenses > 0 ? (catTotals[cat] / monthExpenses) * 100 : 0,
    };
  }).sort((a, b) => b.amount - a.amount);

  const hasIncome = monthIncome > 0;
  const actualSavings = monthIncome - monthExpenses;

  const needsTargetBudget = (monthIncome * ratio.needs) / 100;
  const wantsTargetBudget = (monthIncome * ratio.wants) / 100;
  const savingsTargetBudget = (monthIncome * ratio.savings) / 100;

  const allocationRows: AllocationRow[] = [
    {
      label: 'Needs',
      targetPct: ratio.needs,
      targetBudget: needsTargetBudget,
      actualAmount: monthNeedsSpend,
      actualPct: hasIncome ? (monthNeedsSpend / monthIncome) * 100 : 0,
      difference: needsTargetBudget - monthNeedsSpend,
    },
    {
      label: 'Wants',
      targetPct: ratio.wants,
      targetBudget: wantsTargetBudget,
      actualAmount: monthWantsSpend,
      actualPct: hasIncome ? (monthWantsSpend / monthIncome) * 100 : 0,
      difference: wantsTargetBudget - monthWantsSpend,
    },
    {
      label: 'Savings',
      targetPct: ratio.savings,
      targetBudget: savingsTargetBudget,
      actualAmount: actualSavings,
      actualPct: hasIncome ? (actualSavings / monthIncome) * 100 : 0,
      difference: savingsTargetBudget - actualSavings,
    },
  ];

  return {
    yearMonth,
    monthLabel: formatMonthLabel(yearMonth),
    weeks,
    weeklyRollups,
    monthIncome,
    monthHomeAllowance,
    monthDigitalSalary,
    monthExpenses,
    monthNetBalance: monthIncome - monthExpenses,
    monthNeedsSpend,
    monthWantsSpend,
    categoryRollups,
    allocationRows,
    hasIncome,
    ratio,
  };
}
