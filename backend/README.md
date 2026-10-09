# VANTAGE Backend API & Ingestion Engine

> **Express 5 + Prisma ORM backend service featuring local ONNX financial NLP inference, multi-feed RSS ingestion, and pure deterministic quantitative risk calculations.**

---

## 📌 Technical Overview

The VANTAGE Backend is a high-performance Node.js service designed to process real-time financial market signals and compute portfolio-aware risk parameters.

### Core Responsibilities
1. **Multi-Source News Ingestion**: Automatically fetches and normalizes financial news from AP News, Reuters, Bloomberg, ECB, Federal Reserve, and CNBC.
2. **SHA-256 Deduplication**: Generates deterministic SHA-256 content hashes to eliminate duplicate stories across ingestion cycles.
3. **Local ONNX Financial NLP Pipeline**:
   - **Phase 1D FinBERT ONNX**: Continuous sentiment scoring $s \in [-1.0, +1.0]$ and confidence $c \in [0.0, 1.0]$.
   - **Phase 2 Event Classifier ONNX**: 8-class taxonomy prediction (`Monetary policy`, `Credit`, `Macroeconomic`, `Commodities`, `Geopolitical`, `Sector outlook`, `Earnings`, `Regulatory`).
4. **Deterministic Risk Engine**: Calculates Event Severity ($S_{\text{event}}$), Portfolio Vulnerability ($V_{\text{port}}$), Portfolio Impact ($I_{\text{portfolio}}$), and integer stress shocks (`rate`, `spread`, `liquidity`, `inflation`) with zero LLM numerical dependencies.
5. **Production Financial Loss Engine**: Calculates asset-class loss figures (`loansLoss`, `bondsLoss`, `derivativesLoss`, `equityLoss`) and dynamic attribution percentages.
6. **PostgreSQL Persistence**: Manages relational records via Prisma ORM on Neon Cloud PostgreSQL.

---

## 📂 Backend Architecture & File Directory

```text
backend/
├── models/nlp/                      # Local ONNX Model Artifacts
│   ├── phase1d-finbert/             # Phase 1D FinBERT ONNX model & tokenizer
│   └── phase2-event-classifier/     # Phase 2 ONNX Event Classifier & tokenizer
├── prisma/                          # Relational Database Schema
│   ├── migrations/                  # Versioned PostgreSQL migration files
│   ├── schema.prisma                # Relational Schema Definitions
│   └── seed.ts                      # Initial Portfolio & Holdings Seed Script
├── src/                             # Backend Application Source
│   ├── server.ts                    # Express app entry point
│   ├── db.ts                        # Prisma Client Singleton Instance
│   ├── config/                      # Quantitative Risk Engine Parameters
│   │   └── risk-engine.config.ts    # Centralized Calibration Tables & Shocks
│   ├── controllers/                 # HTTP API Controllers
│   │   └── api.controller.ts        # Request Validation & Response Formatting
│   ├── ingestion/                   # News Ingestion Infrastructure
│   │   ├── adapters/                # RSS & HTML Feed Source Adapters
│   │   ├── deduplication/           # SHA-256 Hashing Engine
│   │   └── ingestion.service.ts     # Multi-Feed Ingestion Manager
│   ├── providers/nlp/               # NLP Inference Pipeline
│   │   ├── finbert-sentiment.analyzer.ts # Local Phase 1D FinBERT ONNX Engine
│   │   ├── financial-context.ts     # Phase 1C Contextual Adjustment Rules
│   │   ├── phase2-event-classifier.ts    # Local Phase 2 ONNX Classifier Engine
│   │   ├── gemini-nlp.provider.ts   # Optional Gemini AI Provider
│   │   ├── development-nlp.provider.ts# Offline Rule Fallback Engine
│   │   └── nlp.service.ts           # Hybrid Pipeline & Risk Engine Orchestrator
│   ├── routes/                      # API Routing Specifications
│   │   └── api.routes.ts            # Express Route Handlers Table
│   └── services/                    # Business Domain Services
│       ├── events/                  # RiskEvent Querying & Persistence
│       ├── portfolios/              # Portfolio Exposure & Asset Weight Manager
│       ├── scenarios/               # Macro Scenario Parameter Generator
│       ├── allocations/             # Sentiment-Adjusted Allocation Optimizer
│       └── risk-engine/             # Quantitative Risk Engine Services
│           ├── deterministic-risk-engine.ts # Pure Impact & Parameter Engine
│           └── risk-engine.service.ts       # Production Loss Execution & Attribution
├── tests/                           # Verification Test Suites
│   ├── run-all.ts                   # Master Automated Test Suite Orchestration
│   ├── test-deterministic-risk-engine.ts # 19 Property Invariants Test Suite
│   ├── test-deterministic-e2e.ts    # Real PostgreSQL E2E Integration Test
│   ├── test-phase1d-integration.ts  # Phase 1D FinBERT ONNX Tests
│   ├── test-phase2-integration.ts  # Phase 2 ONNX Classifier Tests
│   ├── test-real-ingestion-flow.ts  # Real Ingestion Flow Test
│   └── test-api.ts                  # REST Endpoint Integration Tests
└── .env.example                     # Environment Variable Template File
```

---

## ⚙️ Developer Setup & Environment Configuration

### 1. Configure Environment Variables
Create `.env` inside `backend/` directory:

```bash
cp .env.example .env
```

Set your configuration values:

```env
# Database Connection (Neon Cloud PostgreSQL or Local)
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require"

# Server Port
PORT=3000

# Optional Gemini API Key (Used ONLY for semantic text enrichment)
GEMINI_API_KEY="your_optional_gemini_key"

# NLP Provider Selection ('gemini' or 'development')
NLP_PROVIDER=gemini
```

### 2. Database Sync & Client Generation
```bash
# Push schema to PostgreSQL database
npx prisma db push

# Generate Prisma TypeScript Client
npx prisma generate

# Seed baseline portfolio holdings
npx prisma db seed
```

### 3. Running Development Server
```bash
npm run dev
```
*Runs `tsx watch src/server.ts` on `http://localhost:3000`.*

---

## 🧪 Testing & Validation Commands

```bash
# Execute master test suite (runs server in background & executes integration suites)
npm test

# Run pure Deterministic Risk Engine 19 property invariants test directly
npx tsx tests/test-deterministic-risk-engine.ts

# Run Real Database & Stress Test E2E test directly
npx tsx tests/test-deterministic-e2e.ts

# Run Phase 1D FinBERT ONNX test suite
npx tsx tests/test-phase1d-integration.ts

# Run Phase 2 Event Classifier ONNX test suite
npx tsx tests/test-phase2-integration.ts
```

---

## 📡 Key Services & Components

### 1. `DeterministicRiskEngine` (`src/services/risk-engine/deterministic-risk-engine.ts`)
A pure TypeScript service containing zero network, database, or LLM dependencies. Computes Event Severity, Transmission Sensitivity, Concentration Multiplier, Vulnerability Multiplier, Portfolio Impact ($I_{\text{portfolio}} \in [1, 10]$), and Stress Exposure ($E_{\text{stress}}$).

### 2. `RiskEngineService` (`src/services/risk-engine/risk-engine.service.ts`)
Authoritative production financial loss engine. Takes generated integer stress shocks (`rate`, `spread`, `liquidity`, `inflation`) and applies fixed-income duration and spread shift equations to compute absolute loss figures and asset-class attribution.

### 3. `NlpService` (`src/providers/nlp/nlp.service.ts`)
Hybrid NLP pipeline orchestrator. Merges Phase 1D FinBERT sentiment, Phase 2 ONNX classification, and optional Gemini semantic enrichment, then invokes `DeterministicRiskEngine` to output authoritative numerical risk figures.
