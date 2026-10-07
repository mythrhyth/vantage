# VANTAGE — Financial Risk Intelligence Platform

VANTAGE is an enterprise-grade financial risk management platform designed for portfolio managers, risk analysts, and financial institutions. It continuously ingests real-time financial news from trusted global sources (AP News, Reuters, Bloomberg, ECB, Federal Reserve, CNBC), processes and classifies market signals using **Google Gemini AI**, stores structured risk events in **PostgreSQL (Neon)**, and delivers interactive analytics for portfolio exposure tracking, index allocation optimization, and macro/event-driven stress testing.

---

## 🌟 Key Features

1. **Multi-Source News Ingestion**: Automatically fetches, normalizes, and content-hashes financial news from AP News, Reuters, Bloomberg, ECB, Fed, and CNBC.
2. **AI Risk Intelligence Engine**: Powered by Google Gemini AI (`@google/genai` SDK) to extract structured metrics (sentiment, impact, classification, signals, sentiment drivers, risk transmission flows).
3. **Portfolio Relevance Filtering**: Automatically checks ingested events against active equity holdings (`AAPL`, `MSFT`, `GOOGL`, `JPM`, `NVDA`, `AMZN`) and flags portfolio-wide or asset-specific impacts.
4. **Event Explainability Breakdown**: Full transparency into classification reasons, impact factors, risk transmission steps, and direct clickable links to canonical news publisher sources.
5. **Index Allocation Optimization**: Sentiment-adjusted portfolio rebalancing across equity index universes (`NIFTY50`, `S&P 500`).
6. **Macro & Event Stress Testing**: Simulate severe market shocks (Interest Rate Shock, Credit Crisis, Geopolitical Shocks) with step-by-step loss attribution and historical run reproducibility.
7. **Interactive Portfolio Setup**: Configure baseline portfolio value, asset class exposures (Loans, Bonds, Derivatives, Equities), index universe, and individual stock weights with instant PostgreSQL persistence.

---

## 🏗 Architecture Overview

```
                 ┌─────────────────────────────────────────┐
                 │     Trusted Financial News Sources      │
                 │ (AP News, Reuters, Bloomberg, ECB, Fed) │
                 └────────────────────┬────────────────────┘
                                      │ RSS / HTTP Feeds
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │       Ingestion & Deduplication         │
                 │   (SHA-256 Hashing & Relevance Rule)   │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │    Google Gemini AI Risk Engine         │
                 │   (Structured NLP Analysis & Flow)      │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │     PostgreSQL Database (Neon Cloud)    │
                 │   (RiskEvents, Portfolios, Assets, Runs)│
                 └────────────────────┬────────────────────┘
                                      │ REST API / Express
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │      VANTAGE React 19 Web Client        │
                 │ (Risk Intelligence, Stress Test, VaR)   │
                 └─────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React 19, TypeScript
- **Build Tool**: Vite 8
- **Styling**: Vanilla CSS, Tailwind CSS v4

### Backend
- **Runtime**: Node.js, Express 5
- **Database & ORM**: PostgreSQL (Neon Cloud), Prisma ORM 5
- **AI Engine**: Google Gen AI SDK (`@google/genai`) — Model: `gemini-3.8-flash`
- **Ingestion**: `rss-parser`, `axios`

---

## 🚀 Quick Start & Installation Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Neon Cloud database account or local PostgreSQL instance
- **Gemini API Key**: Obtain a free API key from [Google AI Studio](https://aistudio.google.com/)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/financial-risk-intelligence-platform.git
cd financial-risk-intelligence-platform
```

---

### Step 2: Install Dependencies

#### Install Frontend Dependencies (Root)
```bash
npm install
```

#### Install Backend Dependencies
```bash
cd backend
npm install
cd ..
```

---

### Step 3: Configure Environment Variables

Create a `.env` file in the `backend/` directory by copying `.env.example`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your actual credentials:

```env
# PostgreSQL Connection String
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require"

# Server Port
PORT=3000

# Gemini AI API Key
GEMINI_API_KEY="your_actual_gemini_api_key_here"

# NLP Provider Engine ('gemini' or 'development')
NLP_PROVIDER=gemini
```

---

### Step 4: Run Database Migrations & Seed Data

Navigate to the `backend/` folder and initialize Prisma:

```bash
cd backend

# Push schema to database
npx prisma db push

# Generate Prisma Client
npx prisma generate

cd ..
```

---

### Step 5: Start the Development Servers

#### Option A: Terminal 1 — Start Backend Server
```bash
cd backend
npm run dev
```
*Backend server will start on `http://localhost:3000`*

#### Option B: Terminal 2 — Start Frontend Application
```bash
# In project root
npm run dev
```
*Frontend application will start on `http://localhost:8443` (or `http://localhost:5173`)*

---

## 🧪 Running Automated Tests

Run the complete backend integration test suite:

```bash
cd backend
npm test
```

*Runs 28 automated integration tests covering API endpoints, NLP schema validation, portfolio relevance, stress parameter generation, and end-to-end database persistence.*

---

## 📊 API Reference Overview

| Method | Endpoint Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | List ingested financial risk events (supports `portfolioId`, `category`, `source`, `freshness`, `sentiment`, `impact`) |
| `GET` | `/api/events/:id` | Retrieve detailed event metadata, signals, drivers, and canonical source URL |
| `POST` | `/api/events/analyze` | Submit news text for manual Gemini AI analysis & risk event creation |
| `POST` | `/api/ingest` | Trigger manual news ingestion cycle across all active feeds |
| `GET` | `/api/ingestion/sources` | List configured news sources and health metrics |
| `GET` | `/api/portfolios` | List portfolios and baseline valuation |
| `PUT` | `/api/portfolios/:id` | Update portfolio baseline value, universe, and asset exposures |
| `PUT` | `/api/portfolios/:id/holdings` | Update equity holdings and ticker weights |
| `POST` | `/api/allocations/simulate` | Run sentiment-adjusted index allocation optimization |
| `POST` | `/api/stress-tests/generate-parameters` | Map financial risk event to macro stress scenario parameters |
| `POST` | `/api/stress-tests/run` | Execute portfolio stress test, calculate loss attribution, and save run history |
| `GET` | `/api/stress-tests/history` | Retrieve historical stress test execution log |

---

## 📄 License

This project is open-source under the [ISC License](LICENSE).
