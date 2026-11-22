import {
  AppSettings,
  NewTransactionInput,
  SheetMetadata,
  SheetSchemaVersion,
  Transaction,
  TransactionCategory,
  TransactionType,
} from '../types/finance';
import { getWeekInfoForDate, mapCategoryToBucket } from './budgetMath';

const SPREADSHEET_TITLE = 'Student Expense Tracker';
const APP_PROPERTY_KEY = 'weekledgerApp';
const APP_PROPERTY_VALUE = 'student-expense-tracker-v1';
const TRANSACTIONS_TAB = 'Transactions';
const SETTINGS_TAB = 'Settings';

// Exact 8-column schema requested by user:
// id, date, week num, income amount, type, expense amount, type, note
export const TRANSACTIONS_HEADERS_V2 = [
  'ID',
  'Date',
  'Week Num',
  'Income Amount',
  'Income Type',
  'Expense Amount',
  'Expense Type',
  'Note',
];

export class AuthExpiredError extends Error {
  constructor(
    message = 'Your Google session expired. Please sign in again to sync.'
  ) {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

async function googleFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) {
    throw new AuthExpiredError();
  }

  if (!res.ok) {
    let detail = `Google API error (${res.status})`;
    try {
      const json = await res.json();
      if (json?.error?.message) {
        detail = json.error.message;
      }
    } catch {
      // ignore non-json error bodies
    }
    throw new Error(detail);
  }

  return res;
}

interface DriveFileItem {
  id: string;
  name: string;
  webViewLink?: string;
}

async function searchExistingTrackerFile(
  accessToken: string
): Promise<DriveFileItem | null> {
  const propQuery = `appProperties has { key='${APP_PROPERTY_KEY}' and value='${APP_PROPERTY_VALUE}' } and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const propUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    propQuery
  )}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=5`;

  const propRes = await googleFetch(propUrl, accessToken);
  const propData = await propRes.json();
  if (Array.isArray(propData.files) && propData.files.length > 0) {
    return propData.files[0];
  }

  const nameQuery = `name = '${SPREADSHEET_TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
  const nameUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    nameQuery
  )}&fields=files(id,name,webViewLink)&orderBy=modifiedTime desc&pageSize=5`;

  const nameRes = await googleFetch(nameUrl, accessToken);
  const nameData = await nameRes.json();
  if (Array.isArray(nameData.files) && nameData.files.length > 0) {
    return nameData.files[0];
  }

  return null;
}

interface SpreadsheetInfoResponse {
  spreadsheetId: string;
  spreadsheetUrl: string;
  properties: { title: string };
  sheets: Array<{ properties: { sheetId: number; title: string } }>;
}

async function fetchSpreadsheetInfo(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetInfoResponse> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title)`;
  const res = await googleFetch(url, accessToken);
  return res.json();
}

function detectSchemaVersion(headerRow: string[]): SheetSchemaVersion {
  const normalized = headerRow.map((h) => h.trim().toLowerCase());
  if (
    normalized.includes('bucket') ||
    normalized.includes('createdat') ||
    normalized.length >= 9
  ) {
    return 'v1-10col';
  }
  return 'v2-8col';
}

async function ensureRequiredTabs(
  accessToken: string,
  info: SpreadsheetInfoResponse
): Promise<SheetMetadata> {
  const existingTabs = new Map<string, number>();
  for (const s of info.sheets ?? []) {
    existingTabs.set(s.properties.title, s.properties.sheetId);
  }

  const requests: unknown[] = [];
  if (!existingTabs.has(TRANSACTIONS_TAB)) {
    requests.push({
      addSheet: {
        properties: {
          title: TRANSACTIONS_TAB,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }
  if (!existingTabs.has(SETTINGS_TAB)) {
    requests.push({
      addSheet: {
        properties: {
          title: SETTINGS_TAB,
          gridProperties: { frozenRowCount: 1 },
        },
      },
    });
  }

  let updatedInfo = info;
  if (requests.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${info.spreadsheetId}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ requests }),
      }
    );
    updatedInfo = await fetchSpreadsheetInfo(accessToken, info.spreadsheetId);
  }

  const txSheet = updatedInfo.sheets.find(
    (s) => s.properties.title === TRANSACTIONS_TAB
  );
  const transactionsSheetId = txSheet?.properties.sheetId ?? 0;

  // Check existing header row and row 2 to see schema version
  const checkRes = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${info.spreadsheetId}/values/${encodeURIComponent(
      `${TRANSACTIONS_TAB}!A1:J2`
    )}`,
    accessToken
  );
  const checkJson = await checkRes.json();
  const rows: string[][] = checkJson.values ?? [];

  let schemaVersion: SheetSchemaVersion = 'v2-8col';

  if (rows.length === 0) {
    // Empty sheet -> write clean 8-column header
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${info.spreadsheetId}/values/${encodeURIComponent(
        `${TRANSACTIONS_TAB}!A1:H1`
      )}?valueInputOption=USER_ENTERED`,
      accessToken,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [TRANSACTIONS_HEADERS_V2] }),
      }
    );
  } else {
    schemaVersion = detectSchemaVersion(rows[0] ?? []);
    // If old 10-column header exists with ZERO data rows, silently upgrade header cleanly
    if (schemaVersion === 'v1-10col' && rows.length === 1) {
      await googleFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${info.spreadsheetId}/values/${encodeURIComponent(
          `${TRANSACTIONS_TAB}!A1:J1`
        )}?valueInputOption=USER_ENTERED`,
        accessToken,
        {
          method: 'PUT',
          body: JSON.stringify({
            values: [[...TRANSACTIONS_HEADERS_V2, '', '']],
          }),
        }
      );
      schemaVersion = 'v2-8col';
    }
  }

  return {
    spreadsheetId: updatedInfo.spreadsheetId,
    spreadsheetUrl:
      updatedInfo.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${updatedInfo.spreadsheetId}/edit`,
    title: updatedInfo.properties?.title || SPREADSHEET_TITLE,
    transactionsSheetId,
    schemaVersion,
  };
}

export async function findOrCreateTrackerSpreadsheet(
  accessToken: string
): Promise<SheetMetadata> {
  const existing = await searchExistingTrackerFile(accessToken);
  if (existing) {
    const info = await fetchSpreadsheetInfo(accessToken, existing.id);
    return ensureRequiredTabs(accessToken, info);
  }

  // Create a brand new formatted Google Sheet with the clean 8-column schema
  const createRes = await googleFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: SPREADSHEET_TITLE },
        sheets: [
          {
            properties: {
              title: TRANSACTIONS_TAB,
              gridProperties: { frozenRowCount: 1 },
            },
          },
          {
            properties: {
              title: SETTINGS_TAB,
              gridProperties: { frozenRowCount: 1 },
            },
          },
        ],
      }),
    }
  );

  const created: SpreadsheetInfoResponse = await createRes.json();
  const txSheetId =
    created.sheets.find((s) => s.properties.title === TRANSACTIONS_TAB)
      ?.properties.sheetId ?? 0;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${TRANSACTIONS_TAB}!A1:H1`,
            values: [TRANSACTIONS_HEADERS_V2],
          },
          {
            range: `${SETTINGS_TAB}!A1:B3`,
            values: [
              ['Key', 'Value'],
              ['currencyCode', 'USD'],
              ['currencySymbol', '$'],
            ],
          },
        ],
      }),
    }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${created.spreadsheetId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: txSheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 8,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.94, green: 0.97, blue: 0.97 },
                  textFormat: { bold: true },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      }),
    }
  );

  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${created.spreadsheetId}`,
    accessToken,
    {
      method: 'PATCH',
      body: JSON.stringify({
        appProperties: {
          [APP_PROPERTY_KEY]: APP_PROPERTY_VALUE,
        },
      }),
    }
  );

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    title: SPREADSHEET_TITLE,
    transactionsSheetId: txSheetId,
    schemaVersion: 'v2-8col',
  };
}

function parseExactNumeric(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  const cleaned = String(raw ?? '')
    .replace(/[^0-9.-]/g, '')
    .trim();
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

export async function loadSheetData(
  accessToken: string,
  spreadsheetId: string,
  schemaVersion: SheetSchemaVersion
): Promise<{ transactions: Transaction[]; settings: AppSettings }> {
  const ranges = [
    `${TRANSACTIONS_TAB}!A2:J`,
    `${SETTINGS_TAB}!A2:B10`,
  ]
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');

  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges}`,
    accessToken
  );
  const data = await res.json();
  const valueRanges = data.valueRanges ?? [];

  const txRows: string[][] = valueRanges[0]?.values ?? [];
  const settingsRows: string[][] = valueRanges[1]?.values ?? [];

  const transactions: Transaction[] = [];
  txRows.forEach((row, idx) => {
    const rowNumber = idx + 2;
    const rawDate = (row[1] ?? '').trim();
    if (!rawDate) return;

    const weekInfo = getWeekInfoForDate(rawDate);

    if (schemaVersion === 'v1-10col') {
      const rawType = (row[4] ?? '').trim();
      const rawCategory = (row[5] ?? '').trim();
      const rawAmount = parseExactNumeric(row[7]);
      if (rawAmount <= 0) return;

      const type: TransactionType =
        rawType === 'Income' ? 'Income' : 'Expense';
      const category = (rawCategory ||
        (type === 'Income'
          ? 'Home Allowance'
          : 'Others')) as TransactionCategory;

      transactions.push({
        id: (row[0] ?? '').trim() || `row-${rowNumber}`,
        rowNumber,
        date: rawDate,
        month: weekInfo.yearMonth,
        week: weekInfo.weekLabel,
        weekNumber: weekInfo.weekNumber,
        type,
        category,
        bucket: mapCategoryToBucket(type, category),
        amount: rawAmount,
        note: (row[8] ?? '').trim(),
      });
      return;
    }

    // New clean 8-column schema:
    // A: ID | B: Date | C: Week Num | D: Income Amount | E: Income Type | F: Expense Amount | G: Expense Type | H: Note
    const incomeAmount = parseExactNumeric(row[3]);
    const incomeType = (row[4] ?? '').trim();
    const expenseAmount = parseExactNumeric(row[5]);
    const expenseType = (row[6] ?? '').trim();

    let type: TransactionType = 'Expense';
    let category: TransactionCategory = 'Others';
    let amount = 0;

    if (incomeAmount > 0) {
      type = 'Income';
      category = (incomeType || 'Home Allowance') as TransactionCategory;
      amount = incomeAmount;
    } else if (expenseAmount > 0) {
      type = 'Expense';
      category = (expenseType || 'Others') as TransactionCategory;
      amount = expenseAmount;
    } else {
      return;
    }

    transactions.push({
      id: (row[0] ?? '').trim() || `row-${rowNumber}`,
      rowNumber,
      date: rawDate,
      month: weekInfo.yearMonth,
      week: weekInfo.weekLabel,
      weekNumber: weekInfo.weekNumber,
      type,
      category,
      bucket: mapCategoryToBucket(type, category),
      amount,
      note: (row[7] ?? '').trim(),
    });
  });

  // Sort newest date first
  transactions.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.rowNumber - a.rowNumber;
  });

  const settingsMap = new Map<string, string>();
  for (const row of settingsRows) {
    if (row[0]) {
      settingsMap.set(row[0].trim(), (row[1] ?? '').trim());
    }
  }

  const settings: AppSettings = {
    currencyCode: settingsMap.get('currencyCode') || 'USD',
    currencySymbol: settingsMap.get('currencySymbol') || '$',
  };

  return { transactions, settings };
}

function buildRowValuesV2(
  id: string,
  input: NewTransactionInput
): (string | number)[] {
  const weekInfo = getWeekInfoForDate(input.date);
  const exactAmount = input.amount;

  if (input.type === 'Income') {
    return [
      id,
      input.date,
      weekInfo.weekNumber,
      exactAmount,
      input.category,
      '',
      '',
      input.note.trim(),
    ];
  }

  return [
    id,
    input.date,
    weekInfo.weekNumber,
    '',
    '',
    exactAmount,
    input.category,
    input.note.trim(),
  ];
}

function buildRowValuesLegacy(
  id: string,
  input: NewTransactionInput
): (string | number)[] {
  const weekInfo = getWeekInfoForDate(input.date);
  const bucket = mapCategoryToBucket(input.type, input.category);
  return [
    id,
    input.date,
    weekInfo.yearMonth,
    weekInfo.weekLabel,
    input.type,
    input.category,
    bucket,
    input.amount,
    input.note.trim(),
    new Date().toISOString(),
  ];
}

export async function appendTransaction(
  accessToken: string,
  spreadsheetId: string,
  schemaVersion: SheetSchemaVersion,
  input: NewTransactionInput
): Promise<void> {
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const rowValues =
    schemaVersion === 'v1-10col'
      ? buildRowValuesLegacy(id, input)
      : buildRowValuesV2(id, input);

  const range =
    schemaVersion === 'v1-10col'
      ? `${TRANSACTIONS_TAB}!A:J`
      : `${TRANSACTIONS_TAB}!A:H`;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );
}

export async function updateTransactionRow(
  accessToken: string,
  spreadsheetId: string,
  schemaVersion: SheetSchemaVersion,
  existing: Transaction,
  input: NewTransactionInput
): Promise<void> {
  const rowValues =
    schemaVersion === 'v1-10col'
      ? buildRowValuesLegacy(existing.id, input)
      : buildRowValuesV2(existing.id, input);

  const range =
    schemaVersion === 'v1-10col'
      ? `${TRANSACTIONS_TAB}!A${existing.rowNumber}:J${existing.rowNumber}`
      : `${TRANSACTIONS_TAB}!A${existing.rowNumber}:H${existing.rowNumber}`;

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );
}

export async function deleteTransactionRow(
  accessToken: string,
  spreadsheetId: string,
  transactionsSheetId: number,
  rowNumber: number
): Promise<void> {
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: transactionsSheetId,
                dimension: 'ROWS',
                startIndex: rowNumber - 1,
                endIndex: rowNumber,
              },
            },
          },
        ],
      }),
    }
  );
}

export async function migrateLegacySheetTo8Columns(
  accessToken: string,
  spreadsheetId: string,
  transactions: Transaction[]
): Promise<void> {
  // Sort oldest-first for clean chronological sheet order
  const chronological = [...transactions].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const rows: (string | number)[][] = [
    TRANSACTIONS_HEADERS_V2,
    ...chronological.map((tx) =>
      buildRowValuesV2(tx.id, {
        date: tx.date,
        type: tx.type,
        category: tx.category,
        amount: tx.amount,
        note: tx.note,
      })
    ),
  ];

  // Clear old A:J and write clean A:H
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${TRANSACTIONS_TAB}!A:J`
    )}:clear`,
    accessToken,
    { method: 'POST', body: JSON.stringify({}) }
  );

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${TRANSACTIONS_TAB}!A1:H${rows.length}`
    )}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ values: rows }),
    }
  );
}

export async function saveSettingsToSheet(
  accessToken: string,
  spreadsheetId: string,
  settings: AppSettings
): Promise<void> {
  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${SETTINGS_TAB}!A1:B3`
    )}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [
          ['Key', 'Value'],
          ['currencyCode', settings.currencyCode],
          ['currencySymbol', settings.currencySymbol],
        ],
      }),
    }
  );
}
