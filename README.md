# WeekLedger

A clean, responsive student expense and budget tracker that uses **Google Sheets** as its live database. Built for tracking weekly home allowances, digital banking salaries, and everyday expenses across desktop and mobile without backend servers or complex accounting overhead.

---

## Features

- **Google Sheets Auto-Sync**: Authenticates with Google Sign-In and automatically discovers or provisions a `Student Expense Tracker` spreadsheet in your Google Drive (`Transactions` and `Settings` tabs), keeping desktop and mobile synced to one source of truth.
- **Clean 8-Column Ledger Schema**: Every entry writes directly to Google Sheets using the exact columns:
  `ID` · `Date` · `Week Num` · `Income Amount` · `Income Type` · `Expense Amount` · `Expense Type` · `Note`
- **Automatic Sunday-Start Week Calculation**: Selecting any date automatically calculates its Sunday–Saturday calendar week within the month.
- **Student Funding & Expense Categories**:
  - **Income**: `Home Allowance`, `Digital Bank Salary`
  - **Expenses**: `Food`, `Travel`, `Needs` (grouped into **Needs**) and `Wants`, `Others` (grouped into **Wants**)
- **Interactive Pie Chart & Editable Budget Ratio**: Visualizes **Needs / Wants / Savings** allocation against your monthly income with editable percentage targets (defaults to `50 / 30 / 20` and auto-balances to `100%`). All ratio calculations stay strictly in-app.
- **Selectable Monthly Summaries**: Step through any month to inspect total income, total spend, remaining balance, week-by-week breakdowns, and category totals.
- **Safe Editing & Deletion**: Every row update, deletion, or currency setting change requires explicit user confirmation before modifying Google Sheets.
- **Light & Dark Mode**: Persistent theme toggle with refined contrast for both daylight and low-light viewing.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4 (`Plus Jakarta Sans` & `Manrope` with `tabular-nums`)
- **Icons**: Lucide React
- **Authentication**: Firebase Authentication (`GoogleAuthProvider` with in-memory OAuth access token caching)
- **Persistence**: Google Drive API (`drive.file` scope) & Google Sheets API v4 (`spreadsheets` scope)

---

## Getting Started (Local Development)

### Prerequisites

- Node.js 20+ (or Bun)
- A Firebase project with **Google Sign-In** enabled and **Google Drive API** + **Google Sheets API** enabled in Google Cloud Console

### Installation

```bash
# Install dependencies
npm install

# Start the development server on http://localhost:3000
npm run dev
```

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server on port `3000` |
| `npm run build` | Builds the production static bundle into `dist/` |
| `npm run preview` | Previews the production build locally |
| `npm run lint` | Runs TypeScript type-checking (`tsc --noEmit`) |

---

## Deploying to Vercel

Because WeekLedger uses client-side Google Sign-In and communicates directly with the Google Sheets and Drive APIs, it deploys as a pure static site with zero backend configuration.

1. Push this repository to GitHub (or import it directly into [Vercel](https://vercel.com)).
2. Create a new Vercel project using the **Vite** framework preset:
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - SPA routing fallback is pre-configured via `vercel.json`.
3. **Authorize Your Vercel Domain in Firebase**:
   - Open the [Firebase Console](https://console.firebase.google.com/) → **Authentication → Settings → Authorized domains**.
   - Add your deployed domain (e.g. `your-app.vercel.app`) so Google Sign-In popups work on production URLs.

---

## Security & API Key Notes

- **OAuth Access Tokens**: Google Workspace OAuth tokens are held strictly in memory and are never written to `localStorage` or `sessionStorage`.
- **Firebase Web `apiKey` (`firebase-applet-config.json`)**: Firebase web API keys are public project identifiers required by the browser SDK, not private credentials. As a best practice for public repositories, restrict the key in **Google Cloud Console → APIs & Services → Credentials** using **HTTP referrer restrictions** (allowing only your deployed domain and `localhost`) and **API restrictions** (limiting the key to Identity Toolkit / Token Service APIs).

---

## License

Apache-2.0
