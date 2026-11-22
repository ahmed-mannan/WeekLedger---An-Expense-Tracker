import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  ExternalLink,
  LayoutDashboard,
  List,
  Menu,
  Moon,
  Settings as SettingsIcon,
  Sun,
  X,
} from 'lucide-react';
import {
  AppSettings,
  BudgetRatio,
  DEFAULT_BUDGET_RATIO,
  NewTransactionInput,
  SheetMetadata,
  Transaction,
} from './types/finance';
import {
  computeMonthlySummary,
  formatCurrency,
  getCurrentYearMonth,
  getWeekInfoForDate,
  shiftYearMonth,
} from './lib/budgetMath';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './lib/firebaseAuth';
import {
  appendTransaction,
  AuthExpiredError,
  deleteTransactionRow,
  findOrCreateTrackerSpreadsheet,
  loadSheetData,
  migrateLegacySheetTo8Columns,
  saveSettingsToSheet,
  updateTransactionRow,
} from './lib/googleSheets';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { QuickLogForm } from './components/QuickLogForm';
import { BudgetRuleSection } from './components/BudgetRuleSection';
import { MonthlySummarySection } from './components/MonthlySummarySection';
import { TransactionLedger } from './components/TransactionLedger';
import { SettingsView } from './components/SettingsView';
import { ConfirmModal } from './components/ConfirmModal';

type AppPage = 'dashboard' | 'transactions' | 'settings';

type PendingConfirm =
  | { kind: 'edit'; existing: Transaction; updated: NewTransactionInput }
  | { kind: 'delete'; transaction: Transaction }
  | { kind: 'settings'; nextSettings: AppSettings }
  | { kind: 'migrate' }
  | null;

const THEME_STORAGE_KEY = 'weekledger-theme';
const RATIO_STORAGE_KEY = 'weekledger-budget-ratio';

function loadInitialRatio(): BudgetRatio {
  try {
    const raw = localStorage.getItem(RATIO_STORAGE_KEY);
    if (!raw) return DEFAULT_BUDGET_RATIO;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.needs === 'number' &&
      typeof parsed?.wants === 'number' &&
      typeof parsed?.savings === 'number' &&
      parsed.needs + parsed.wants + parsed.savings === 100
    ) {
      return parsed;
    }
  } catch {
    // ignore storage parse error
  }
  return DEFAULT_BUDGET_RATIO;
}

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(() =>
    document.documentElement.classList.contains('dark')
  );
  const [budgetRatio, setBudgetRatio] = useState<BudgetRatio>(loadInitialRatio);

  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [authInitialized, setAuthInitialized] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [sheetMeta, setSheetMeta] = useState<SheetMetadata | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    currencyCode: 'USD',
    currencySymbol: '$',
  });

  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const currentYearMonth = getCurrentYearMonth();
  const [summaryMonth, setSummaryMonth] = useState<string>(currentYearMonth);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState<boolean>(false);

  const logFormRef = useRef<HTMLDivElement | null>(null);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
      } catch {
        // ignore storage error
      }
      return next;
    });
  };

  const handleChangeRatio = (next: BudgetRatio) => {
    setBudgetRatio(next);
    try {
      localStorage.setItem(RATIO_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage error
    }
  };

  const bootstrapAndLoadSheet = useCallback(async (token: string) => {
    setIsLoadingSheet(true);
    setSyncError(null);
    try {
      const meta = await findOrCreateTrackerSpreadsheet(token);
      setSheetMeta(meta);
      const data = await loadSheetData(
        token,
        meta.spreadsheetId,
        meta.schemaVersion
      );
      setTransactions(data.transactions);
      setSettings(data.settings);
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
        setSyncError(err.message);
      } else {
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Unable to load your Google Sheet right now.'
        );
      }
    } finally {
      setIsLoadingSheet(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setNeedsAuth(false);
        setAuthInitialized(true);
        void bootstrapAndLoadSheet(token);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
        setAuthInitialized(true);
      }
    );
    return () => unsubscribe();
  }, [bootstrapAndLoadSheet]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [menuOpen]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    setSyncError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
        await bootstrapAndLoadSheet(result.accessToken);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled.';
      setAuthError(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    setSheetMeta(null);
    setTransactions([]);
    setEditingTx(null);
    setActivePage('dashboard');
    setMenuOpen(false);
  };

  const refreshFromSheet = async () => {
    const token = getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    if (!sheetMeta) {
      await bootstrapAndLoadSheet(token);
      return;
    }
    setIsLoadingSheet(true);
    setSyncError(null);
    try {
      const data = await loadSheetData(
        token,
        sheetMeta.spreadsheetId,
        sheetMeta.schemaVersion
      );
      setTransactions(data.transactions);
      setSettings(data.settings);
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
      }
      setSyncError(
        err instanceof Error ? err.message : 'Failed to refresh sheet data.'
      );
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const handleCreateTransaction = async (
    input: NewTransactionInput
  ): Promise<boolean> => {
    const token = getAccessToken();
    if (!token || !sheetMeta) {
      setNeedsAuth(true);
      return false;
    }
    setIsSubmitting(true);
    setSyncError(null);
    try {
      await appendTransaction(
        token,
        sheetMeta.spreadsheetId,
        sheetMeta.schemaVersion,
        input
      );
      const data = await loadSheetData(
        token,
        sheetMeta.spreadsheetId,
        sheetMeta.schemaVersion
      );
      setTransactions(data.transactions);

      const weekInfo = getWeekInfoForDate(input.date);
      if (weekInfo.yearMonth !== summaryMonth) {
        setSummaryMonth(weekInfo.yearMonth);
      }
      return true;
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
      }
      setSyncError(
        err instanceof Error
          ? err.message
          : 'Could not save entry to Google Sheets.'
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExecutePendingConfirm = async () => {
    if (!pendingConfirm) return;
    const token = getAccessToken();
    if (!token || !sheetMeta) {
      setPendingConfirm(null);
      setNeedsAuth(true);
      return;
    }

    setIsConfirmingAction(true);
    setSyncError(null);
    try {
      if (pendingConfirm.kind === 'edit') {
        await updateTransactionRow(
          token,
          sheetMeta.spreadsheetId,
          sheetMeta.schemaVersion,
          pendingConfirm.existing,
          pendingConfirm.updated
        );
        setEditingTx(null);
      } else if (pendingConfirm.kind === 'delete') {
        await deleteTransactionRow(
          token,
          sheetMeta.spreadsheetId,
          sheetMeta.transactionsSheetId,
          pendingConfirm.transaction.rowNumber
        );
        if (editingTx?.id === pendingConfirm.transaction.id) {
          setEditingTx(null);
        }
      } else if (pendingConfirm.kind === 'settings') {
        await saveSettingsToSheet(
          token,
          sheetMeta.spreadsheetId,
          pendingConfirm.nextSettings
        );
        setSettings(pendingConfirm.nextSettings);
      } else if (pendingConfirm.kind === 'migrate') {
        await migrateLegacySheetTo8Columns(
          token,
          sheetMeta.spreadsheetId,
          transactions
        );
        const updatedMeta: SheetMetadata = {
          ...sheetMeta,
          schemaVersion: 'v2-8col',
        };
        setSheetMeta(updatedMeta);
        const data = await loadSheetData(
          token,
          updatedMeta.spreadsheetId,
          'v2-8col'
        );
        setTransactions(data.transactions);
      }

      if (
        pendingConfirm.kind !== 'settings' &&
        pendingConfirm.kind !== 'migrate'
      ) {
        const data = await loadSheetData(
          token,
          sheetMeta.spreadsheetId,
          sheetMeta.schemaVersion
        );
        setTransactions(data.transactions);
      }
      setPendingConfirm(null);
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        clearAccessToken();
        setNeedsAuth(true);
      }
      setSyncError(
        err instanceof Error ? err.message : 'Failed to update Google Sheets.'
      );
      setPendingConfirm(null);
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const currentMonthSummary = useMemo(
    () =>
      computeMonthlySummary(transactions, currentYearMonth, budgetRatio),
    [transactions, currentYearMonth, budgetRatio]
  );

  const selectedMonthSummary = useMemo(
    () => computeMonthlySummary(transactions, summaryMonth, budgetRatio),
    [transactions, summaryMonth, budgetRatio]
  );

  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setActivePage('dashboard');
    setMenuOpen(false);
    setTimeout(() => {
      logFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const displayName =
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Student';

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] flex items-center justify-center p-6">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          Initializing session...
        </div>
      </div>
    );
  }

  // Signed-out / Reconnect Landing
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] flex flex-col">
        <header className="w-full bg-white dark:bg-[#111113] border-b border-zinc-200 dark:border-zinc-800 px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
            WeekLedger
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <GoogleSignInButton
              onClick={handleLogin}
              disabled={isLoggingIn}
              label={isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
            />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
          <div className="w-full max-w-xl bg-white dark:bg-[#111113] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-10">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Google Sheets Student Expense Tracker
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 text-balance">
              {user
                ? 'Reconnect your Google Sheet to continue'
                : 'Simple expense logging, stored cleanly in Google Sheets.'}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {user
                ? `Signed in as ${user.email}. Continue with Google to reconnect your session and log entries to your spreadsheet.`
                : 'Log your weekly home allowance, bank salary, and daily expenses in seconds. Every row is written cleanly to your Google Sheet with automatic Sunday-start week numbers.'}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <GoogleSignInButton
                onClick={handleLogin}
                disabled={isLoggingIn}
                label={
                  isLoggingIn
                    ? 'Connecting...'
                    : user
                      ? 'Continue with Google'
                      : 'Sign in with Google'
                }
              />
              {user && (
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 border border-zinc-300 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Use Different Account
                </button>
              )}
            </div>

            {authError && (
              <p
                role="alert"
                className="mt-4 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl px-3.5 py-2.5"
              >
                {authError}
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#09090B] pb-12">
      {/* Minimal Top Bar: App Name on left + Theme toggle & 3-line Menu Button on right */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#111113]/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setActivePage('dashboard');
              setMenuOpen(false);
            }}
            className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-emerald-600 rounded"
          >
            WeekLedger
          </button>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              {isDark ? (
                <Sun className="w-[18px] h-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="w-[18px] h-[18px]" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
            >
              {menuOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* 3-line Action Bar (Dashboard, Transactions, Settings, Open Sheets) */}
        {menuOpen && (
          <div className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111113] shadow-sm">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivePage('dashboard');
                  setMenuOpen(false);
                }}
                className={`min-h-[44px] px-3.5 py-2 text-sm font-medium rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activePage === 'dashboard'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
                <span>Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePage('transactions');
                  setMenuOpen(false);
                }}
                className={`min-h-[44px] px-3.5 py-2 text-sm font-medium rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activePage === 'transactions'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <List className="w-4 h-4" aria-hidden="true" />
                <span>Transactions</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePage('settings');
                  setMenuOpen(false);
                }}
                className={`min-h-[44px] px-3.5 py-2 text-sm font-medium rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
                  activePage === 'settings'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <SettingsIcon className="w-4 h-4" aria-hidden="true" />
                <span>Settings</span>
              </button>

              {sheetMeta && (
                <a
                  href={sheetMeta.spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950 rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <span>Open Sheets</span>
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Global Sync Error Banner */}
        {syncError && (
          <div
            role="alert"
            className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-sm text-rose-700 dark:text-rose-300"
          >
            <span>{syncError}</span>
            <button
              type="button"
              onClick={refreshFromSheet}
              className="min-h-[36px] px-3 py-1 text-xs font-medium bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 rounded-lg hover:bg-rose-100/50 dark:hover:bg-rose-900/40 transition-colors"
            >
              Retry Sync
            </button>
          </div>
        )}

        {/* Legacy 10-column migration prompt if old sheet has rows */}
        {sheetMeta?.schemaVersion === 'v1-10col' &&
          transactions.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-950 dark:text-amber-200">
              <div>
                <p className="font-medium">
                  Update spreadsheet columns to the new 8-column format?
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
                  Your sheet currently uses the older 10-column headers. Upgrade
                  safely to ID, Date, Week Num, Income Amount, Type, Expense
                  Amount, Type, Note.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm({ kind: 'migrate' })}
                className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl whitespace-nowrap shrink-0 self-start sm:self-auto"
              >
                Upgrade Sheet Columns
              </button>
            </div>
          )}

        {/* PAGE 1: DASHBOARD */}
        {activePage === 'dashboard' && (
          <>
            {/* Welcome + Quick Current Month Summary */}
            <section className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Welcome, {displayName}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                Quick summary for {currentMonthSummary.monthLabel}
              </p>

              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Total Income
                  </span>
                  <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(
                      currentMonthSummary.monthIncome,
                      settings.currencySymbol
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    Home{' '}
                    {formatCurrency(
                      currentMonthSummary.monthHomeAllowance,
                      settings.currencySymbol
                    )}{' '}
                    · Bank{' '}
                    {formatCurrency(
                      currentMonthSummary.monthDigitalSalary,
                      settings.currencySymbol
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Total Spend
                  </span>
                  <div className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-50">
                    {formatCurrency(
                      currentMonthSummary.monthExpenses,
                      settings.currencySymbol
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                    Needs{' '}
                    {formatCurrency(
                      currentMonthSummary.monthNeedsSpend,
                      settings.currencySymbol
                    )}{' '}
                    · Wants{' '}
                    {formatCurrency(
                      currentMonthSummary.monthWantsSpend,
                      settings.currencySymbol
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Balance Left
                  </span>
                  <div
                    className={`mt-1 text-2xl font-bold tracking-tight tabular-nums ${
                      currentMonthSummary.monthNetBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-zinc-900 dark:text-zinc-50'
                    }`}
                  >
                    {formatCurrency(
                      currentMonthSummary.monthNetBalance,
                      settings.currencySymbol
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {currentMonthSummary.monthNetBalance >= 0
                      ? 'Remaining this month'
                      : 'Expenses exceed income'}
                  </div>
                </div>
              </div>
            </section>

            {/* Simple Logging Options */}
            <div ref={logFormRef}>
              <QuickLogForm
                currencySymbol={settings.currencySymbol}
                editingTransaction={editingTx}
                isSubmitting={isSubmitting}
                onSubmitNew={handleCreateTransaction}
                onRequestEditConfirm={(existing, updated) =>
                  setPendingConfirm({ kind: 'edit', existing, updated })
                }
                onCancelEdit={() => setEditingTx(null)}
              />
            </div>

            {/* In-App Pie Chart + Editable Ratio Allocation Table */}
            <BudgetRuleSection
              summary={selectedMonthSummary}
              currencySymbol={settings.currencySymbol}
              ratio={budgetRatio}
              onChangeRatio={handleChangeRatio}
            />

            {/* Selectable Monthly Summary */}
            <MonthlySummarySection
              summary={selectedMonthSummary}
              currencySymbol={settings.currencySymbol}
              onChangeMonth={(delta) =>
                setSummaryMonth((prev) => shiftYearMonth(prev, delta))
              }
            />
          </>
        )}

        {/* PAGE 2: TRANSACTIONS (Clean History Only) */}
        {activePage === 'transactions' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 inline-flex items-center gap-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </button>

            <TransactionLedger
              transactions={transactions}
              currencySymbol={settings.currencySymbol}
              isLoading={isLoadingSheet}
              onEdit={handleStartEdit}
              onRequestDelete={(tx) =>
                setPendingConfirm({ kind: 'delete', transaction: tx })
              }
              onGoToDashboard={() => setActivePage('dashboard')}
            />
          </div>
        )}

        {/* PAGE 3: SETTINGS */}
        {activePage === 'settings' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className="min-h-[40px] px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-50 inline-flex items-center gap-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Back to Dashboard</span>
            </button>

            <SettingsView
              userEmail={user?.email ?? ''}
              userName={user?.displayName ?? ''}
              sheetMeta={sheetMeta}
              settings={settings}
              isSyncing={isLoadingSheet}
              onSyncNow={refreshFromSheet}
              onRequestSaveCurrency={(next) =>
                setPendingConfirm({ kind: 'settings', nextSettings: next })
              }
              onSignOut={handleSignOut}
            />
          </div>
        )}
      </main>

      {/* Mandatory Confirmation Dialogs for Google Sheets Mutations */}
      {pendingConfirm?.kind === 'edit' && (
        <ConfirmModal
          open
          title="Update entry in Google Sheets?"
          description={`This will update row ${pendingConfirm.existing.rowNumber} in your "${sheetMeta?.title ?? 'Student Expense Tracker'}" spreadsheet.`}
          details={[
            { label: 'Date', value: pendingConfirm.updated.date },
            {
              label: 'Type & Category',
              value: `${pendingConfirm.updated.type} · ${pendingConfirm.updated.category}`,
            },
            {
              label: 'Amount',
              value: formatCurrency(
                pendingConfirm.updated.amount,
                settings.currencySymbol
              ),
            },
            {
              label: 'Note',
              value: pendingConfirm.updated.note || '—',
            },
          ]}
          confirmLabel="Confirm Update"
          tone="primary"
          isProcessing={isConfirmingAction}
          onConfirm={handleExecutePendingConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm?.kind === 'delete' && (
        <ConfirmModal
          open
          title="Delete entry from Google Sheets?"
          description={`This will permanently remove row ${pendingConfirm.transaction.rowNumber} from your Google Sheet. This cannot be undone.`}
          details={[
            { label: 'Date', value: pendingConfirm.transaction.date },
            {
              label: 'Category',
              value: `${pendingConfirm.transaction.type} · ${pendingConfirm.transaction.category}`,
            },
            {
              label: 'Amount',
              value: formatCurrency(
                pendingConfirm.transaction.amount,
                settings.currencySymbol
              ),
            },
            {
              label: 'Note',
              value: pendingConfirm.transaction.note || '—',
            },
          ]}
          confirmLabel="Delete Row"
          tone="danger"
          isProcessing={isConfirmingAction}
          onConfirm={handleExecutePendingConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm?.kind === 'settings' && (
        <ConfirmModal
          open
          title="Update currency settings in Google Sheets?"
          description="This will update the Settings tab inside your Google Sheet so all devices display your new currency."
          details={[
            {
              label: 'Currency Code',
              value: pendingConfirm.nextSettings.currencyCode,
            },
            {
              label: 'Symbol',
              value: pendingConfirm.nextSettings.currencySymbol,
            },
          ]}
          confirmLabel="Save Currency"
          tone="primary"
          isProcessing={isConfirmingAction}
          onConfirm={handleExecutePendingConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}

      {pendingConfirm?.kind === 'migrate' && (
        <ConfirmModal
          open
          title="Upgrade spreadsheet columns to 8-column layout?"
          description={`This will reorganize ${transactions.length} existing row(s) into the clean 8-column format: ID, Date, Week Num, Income Amount, Income Type, Expense Amount, Expense Type, Note.`}
          details={[
            {
              label: 'Rows Preserved',
              value: String(transactions.length),
            },
            {
              label: 'New Columns',
              value: '8 columns (A:H)',
            },
          ]}
          confirmLabel="Upgrade Sheet"
          tone="primary"
          isProcessing={isConfirmingAction}
          onConfirm={handleExecutePendingConfirm}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </div>
  );
}
