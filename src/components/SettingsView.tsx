import React, { useEffect, useState } from 'react';
import { ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import {
  AppSettings,
  CURRENCY_PRESETS,
  SheetMetadata,
} from '../types/finance';

interface SettingsViewProps {
  userEmail: string;
  userName: string;
  sheetMeta: SheetMetadata | null;
  settings: AppSettings;
  isSyncing: boolean;
  onSyncNow: () => void;
  onRequestSaveCurrency: (next: AppSettings) => void;
  onSignOut: () => void;
}

export function SettingsView({
  userEmail,
  userName,
  sheetMeta,
  settings,
  isSyncing,
  onSyncNow,
  onRequestSaveCurrency,
  onSignOut,
}: SettingsViewProps) {
  const [selectedCode, setSelectedCode] = useState(settings.currencyCode);
  const [customSymbol, setCustomSymbol] = useState(settings.currencySymbol);
  const [customCode, setCustomCode] = useState(settings.currencyCode);
  const [useCustom, setUseCustom] = useState(
    !CURRENCY_PRESETS.some((p) => p.code === settings.currencyCode)
  );

  useEffect(() => {
    setSelectedCode(settings.currencyCode);
    setCustomSymbol(settings.currencySymbol);
    setCustomCode(settings.currencyCode);
    setUseCustom(
      !CURRENCY_PRESETS.some((p) => p.code === settings.currencyCode)
    );
  }, [settings.currencyCode, settings.currencySymbol]);

  const handlePresetChange = (code: string) => {
    if (code === 'CUSTOM') {
      setUseCustom(true);
      return;
    }
    setUseCustom(false);
    setSelectedCode(code);
    const preset = CURRENCY_PRESETS.find((p) => p.code === code);
    if (preset) {
      setCustomCode(preset.code);
      setCustomSymbol(preset.symbol);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const nextCode =
      (useCustom ? customCode : selectedCode).trim().toUpperCase() || 'USD';
    const nextSymbol = customSymbol.trim() || '$';
    onRequestSaveCurrency({
      currencyCode: nextCode,
      currencySymbol: nextSymbol,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Google Sheet Connection */}
      <section className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Google Sheets Database
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Every entry you log is stored in your own Google Drive spreadsheet so
          you can inspect, export, or manage your budget manually anytime.
        </p>

        {sheetMeta && (
          <dl className="mt-4 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-2.5 text-sm min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <dt className="text-zinc-500 dark:text-zinc-400">
                Spreadsheet Name
              </dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100 break-words min-w-0">
                {sheetMeta.title}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
              <dt className="text-zinc-500 dark:text-zinc-400">
                Connected Account
              </dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100 break-all min-w-0">
                {userName ? `${userName} (${userEmail})` : userEmail}
              </dd>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="text-zinc-500 dark:text-zinc-400">Tabs</dt>
              <dd className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Transactions · Settings
              </dd>
            </div>
          </dl>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {sheetMeta && (
            <a
              href={sheetMeta.spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
            >
              <span>Open in Google Sheets</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap disabled:opacity-60"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
            <span>{isSyncing ? 'Syncing...' : 'Refresh from Sheet'}</span>
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </section>

      {/* Currency Preferences */}
      <section className="bg-white dark:bg-[#111113] border border-zinc-200/90 dark:border-zinc-800 rounded-2xl p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Currency Display
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Saved inside your spreadsheet&apos;s Settings tab so PC and mobile
          stay in sync.
        </p>

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="currency-preset"
              className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Currency
            </label>
            <select
              id="currency-preset"
              value={useCustom ? 'CUSTOM' : selectedCode}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full sm:max-w-sm min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-600/15"
            >
              {CURRENCY_PRESETS.map((preset) => (
                <option key={preset.code} value={preset.code}>
                  {preset.label}
                </option>
              ))}
              <option value="CUSTOM">Custom Currency Symbol...</option>
            </select>
          </div>

          {useCustom && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-sm">
              <div>
                <label
                  htmlFor="custom-code"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Code (e.g., BDT)
                </label>
                <input
                  id="custom-code"
                  type="text"
                  maxLength={6}
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="custom-symbol"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Symbol (e.g., ৳)
                </label>
                <input
                  id="custom-symbol"
                  type="text"
                  maxLength={4}
                  value={customSymbol}
                  onChange={(e) => setCustomSymbol(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm text-zinc-900 dark:text-zinc-50 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:border-emerald-600 dark:focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="min-h-[44px] px-5 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-zinc-950 rounded-xl transition-colors whitespace-nowrap"
          >
            Save Currency Preference
          </button>
        </form>
      </section>
    </div>
  );
}
