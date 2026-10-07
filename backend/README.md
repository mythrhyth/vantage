# VANTAGE Backend API & Ingestion Engine

The VANTAGE Backend is a Node.js + Express + Prisma ORM service responsible for:
- Ingesting financial news RSS feeds from AP News, Reuters, Bloomberg, ECB, Fed, and CNBC.
- Hashing content (SHA-256) to eliminate exact duplicates across ingestion cycles.
- Evaluating portfolio relevance against active equity holdings (`AAPL`, `MSFT`, `GOOGL`, `JPM`, `NVDA`, `AMZN`).
- Extracting structured risk intelligence using **Google Gemini AI** (`gemini-3.8-flash` via `@google/genai` SDK).
- Managing PostgreSQL database operations on Neon Cloud.
- Running sentiment-adjusted portfolio allocation optimization and stress test simulations.

---

## 📁 Directory Structure

```text
backend/
├── src/
│   ├── server.ts                    # Express app entry point
│   ├── db.ts                        # Prisma client instance
│   ├── controllers/
│   │   └── api.controller.ts        # REST API route handlers
│   ├── ingestion/
│   │   ├── adapters/                # RSS & HTML feed adapters
│   │   ├── deduplication/           # SHA-256 hash & title deduplication
│   │   ├── event-clustering.ts      # Similarity clustering
│   │   ├── ingestion.service.ts     # Multi-source orchestration service
│   │   └── source-adapter.manager.ts# Source registry manager
│   ├── middleware/
│   │   └── error.middleware.ts      # Global error handling middleware
│   ├── routes/
│   │   └── api.routes.ts            # Express endpoints routing table
│   ├── services/
│   │   ├── allocation.service.ts    # Portfolio index allocation optimizer
│   │   ├── event.service.ts         # RiskEvent querying & mapping service
│   │   ├── nlp/                     # Gemini AI & Fallback NLP providers
│   │   ├── portfolio.service.ts     # Portfolio exposure & holdings manager
│   │   ├── risk-engine.service.ts   # Stress test simulation & loss attribution
│   │   └── scenario.service.ts      # Macro scenario mapping service
│   ├── types/                       # Shared backend TypeScript types
│   └── utils/                       # Logging & helper utilities
├── tests/                           # Integration & unit test suite
├── prisma/
│   ├── migrations/                  # Prisma database migration scripts
│   └── schema.prisma                # PostgreSQL data schema
└── .env.example                     # Environment template file
```

---

## ⚡ Setup & Commands

### 1. Environment Setup
Copy `.env.example` to `.env` and fill in your database URL and Gemini API Key:

```bash
cp .env.example .env
```

### 2. Database Sync & Client Generation
```bash
npx prisma db push
npx prisma generate
```

### 3. Start Development Server
```bash
npm run dev
```
*Runs `tsx watch src/server.ts` on port 3000.*

### 4. Execute Ingestion Cycle Manually
```bash
npm run ingest
```

### 5. Run Test Suite
```bash
npm test
```
