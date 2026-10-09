# VANTAGE — Deterministic & Portfolio-Aware Financial Risk Intelligence Platform

> **Transform unstructured global financial news into portfolio-aware risk signals, local ONNX-driven event classification, and deterministic, calculation-backed stress loss attribution.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg?logo=nodedotjs)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react)](https://react.dev/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-v2.17.2-orange.svg?logo=onnx)](https://onnxruntime.ai/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-336791.svg?logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![Build & Test](https://img.shields.io/badge/Test_Suite-100%25_Passing-brightgreen.svg)]()

---

## 📌 Table of Contents
- [Executive Summary & Core Value Proposition](#-executive-summary--core-value-proposition)
- [The Problem: Why Traditional Risk Dashboards Fail](#-the-problem-why-traditional-risk-dashboards-fail)
- [What Makes VANTAGE Different? (Unique Selling Proposition)](#-what-makes-vantage-different-unique-selling-proposition)
- [End-to-End System Architecture](#-end-to-end-system-architecture)
- [Mathematical & Technical Risk Model](#-mathematical--technical-risk-model)
- [Key Platform Features](#-key-platform-features)
- [Technology Stack](#-technology-stack)
- [Repository Organization](#-repository-organization)
- [Installation & Quick Start Guide](#-installation--quick-start-guide)
- [API Quick Reference](#-api-quick-reference)
- [Automated Test Suite & Empirical Verification](#-automated-test-suite--empirical-verification)
- [Limitations & Responsible Analytical Use](#-limitations--responsible-analytical-use)
- [Future Engineering Roadmap](#-future-engineering-roadmap)
- [Credits & Licensing](#-credits--licensing)

---

## 💡 Executive Summary & Core Value Proposition

Financial risk management teams and portfolio managers face an overwhelming volume of daily macroeconomic headlines, central bank announcements, and sector shocks. Traditional financial dashboards either rely on **generic sentiment scores** (which treat all negative news equally regardless of portfolio composition) or rely on **black-box LLMs** to hallucinate numerical financial loss figures.

**VANTAGE** bridges the gap between unstructured financial NLP and rigorous financial quantitative risk modeling. By combining **fine-tuned local ONNX models** (FinBERT for continuous sentiment and fine-tuned ONNX for 8-class event taxonomy) with a **pure Deterministic Risk Engine**, VANTAGE translates real-time financial market signals directly into portfolio-specific exposure shifts, macro stress parameters (`rate`, `spread`, `liquidity`, `inflation`), and calculation-backed asset-class loss attribution.

---

## 📉 The Problem: Why Traditional Risk Dashboards Fail

Existing financial risk intelligence workflows suffer from four fundamental architectural limitations:

1. **Sentiment Disconnect**: Negative sentiment does not automatically equal high financial loss. A 50 bps rate hike headline has a drastically different impact on a 80% fixed-income portfolio versus an 80% technology equity portfolio.
2. **LLM Hallucination in Numerical Risk**: Asking a generative LLM to output a financial loss estimate (e.g. *"predict the loss in Crore INR"*) yields non-deterministic, uncalibrated numbers that violate financial duration and spread sensitivities.
3. **Lack of Exposure Filtering**: General news aggregators alert managers to market events that are completely irrelevant to their actual holdings or sector concentrations.
4. **Opaque Black-Box Attribution**: Risk managers cannot audit or explain static prototype percentages (e.g., hardcoded 47% Loan / 31% Bond splits) to executive committees when market shocks occur.

---

## 🚀 What Makes VANTAGE Different? (Unique Selling Proposition)

### 1. 100% Local ONNX Inference for Authoritative NLP
- **FinBERT Sentiment**: Fine-tuned BERT model compiled to local ONNX format. Emits continuous sentiment $s \in [-1.0, +1.0]$ and confidence $c \in [0.0, 1.0]$ using transformers.js in Node.js.
- **Event Classifier**: Fine-tuned ONNX model evaluating text across **8 authoritative production categories**: `Monetary policy`, `Credit`, `Macroeconomic`, `Commodities`, `Geopolitical`, `Sector outlook`, `Earnings`, and `Regulatory`.
- **Zero Cloud LLM Dependency for Numerical Risk**: Even when external APIs (like Gemini) hit HTTP 429 rate limits or 503 service outages, VANTAGE continues computing exact numerical risk scores, stress parameters, and portfolio losses.

### 2. Strict Separation of AI & Quantitative Responsibilities
- **AI/NLP Role**: Extracts classification taxonomy, continuous sentiment, and optional semantic explanations (entity resolution, signals, sentiment drivers, risk transmission steps).
- **Quantitative Engine Role**: Calculates Event Severity ($S_{\text{event}}$), Portfolio Vulnerability ($V_{\text{port}}$), Portfolio Impact ($I_{\text{portfolio}}$), Stress Parameters, Stressed Valuation, and Dynamic Asset-Class Loss Attribution using inspectable, inspectable mathematical formulas.

### 3. Portfolio-Aware Relevance & Transmission Matrix
- Evaluates whether an event is `DIRECT` (matched holding ID/ticker), `INDIRECT` (matched sector), `PORTFOLIO_WIDE` (macroeconomic/monetary policy), or `IRRELEVANT` (zero matching exposure).
- Uses a **Category $\times$ Asset Class Transmission Matrix** ($W_{\text{cat, asset}}$) to scale transmission sensitivity ($T_{\text{port}}$) across Loans, Bonds, Derivatives, and Equities.

### 4. Dynamic, Calculation-Backed Loss Attribution
- Backend financial loss execution computes absolute loss for each asset class:
  $$\text{share}_A = \frac{\text{loss}_A}{\text{totalLoss}} \times 100$$
- Frontend components (`WhyLossDialog.tsx` and `AssetLossDialog.tsx`) render exact calculated backend attribution shares without hardcoded prototype fallbacks.

---

## 🏗 End-to-End System Architecture

![VANTAGE End-to-End System Architecture Pipeline](docs/assets/architecture_flow.svg)

<details>
<summary><b>📐 View Editable Mermaid Source Code</b></summary>

```mermaid
flowchart TD
    subgraph Ingestion ["1. Multi-Source Financial Ingestion"]
        A1[AP News / Reuters / Bloomberg] --> B[Ingestion Orchestrator]
        A2[ECB / Federal Reserve / CNBC] --> B
        B --> C[SHA-256 Deduplication & Content Hash]
    end

    subgraph Relevance ["2. Portfolio Relevance Engine"]
        C --> D[Holding Ticker & Sector Matcher]
        D --> E{Relevance Type}
        E -->|Direct Ticker Match| E1[DIRECT]
        E -->|Sector Match| E2[INDIRECT]
        E -->|Macro Category| E3[PORTFOLIO_WIDE]
        E -->|Zero Exposure| E4[IRRELEVANT]
    end

    subgraph NLP ["3. Local ONNX Financial NLP Pipeline"]
        C --> F[FinBERT ONNX Engine]
        C --> G[Event Classifier ONNX]
        C -->|Optional Enrichment| H[Gemini AI Provider]

        F -->|Authoritative Sentiment| I[Risk Event Payload]
        G -->|Authoritative Category| I
        H -.->|Semantic Explanations| I
    end

    subgraph Engine ["4. Deterministic Risk Engine"]
        I --> J[DeterministicRiskEngine.calculateRisk]
        E1 --> J
        E2 --> J
        E3 --> J
        E4 --> J

        J --> K1[Event Severity S_event]
        J --> K2[Transmission Sensitivity T_port]
        J --> K3[Portfolio Impact I_portfolio]
        J --> K4[Stress Parameters: rate, spread, liquidity, inflation]
    end

    subgraph LossEngine ["5. Quantitative Financial Loss Engine"]
        K4 --> L[RiskEngineService.runStressTest]
        L --> M1[Loans Duration & Spread Loss]
        L --> M2[Bonds Yield Shift Loss]
        L --> M3[Derivatives Liquidity Haircut Loss]
        L --> M4[Equity Inflation & Rate Loss]

        M1 --> N[Stressed Valuation & Risk Score]
        M2 --> N
        M3 --> N
        M4 --> N
        N --> O[Dynamic Asset Loss Attribution]
    end

    subgraph Persistence ["6. Persistence & Presentation"]
        I --> P[(PostgreSQL / Neon Cloud)]
        N --> P
        P --> Q[React 19 Risk Intelligence Dashboard]
        P --> R[Stress Testing & Explainability UI]
    end
```
</details>

---

## 📐 Mathematical & Technical Risk Model

### 1. Event Severity ($S_{\text{event}}$)
Combines base category severity $S_{\text{cat}}$ with continuous FinBERT sentiment $s \in [-1.0, +1.0]$ via sentiment multiplier $M_{\text{sent}}(s) = 1.0 - 0.35s$:
$$S_{\text{event}} = \text{clamp}\left(1.0, 10.0, S_{\text{cat}} \times M_{\text{sent}}(s)\right)$$

| Category | Base Severity ($S_{\text{cat}}$) | Base Rate Shock (bps) | Base Spread Shock (bps) | Base Liquidity (%) | Base Inflation (bps) |
|---|:---:|:---:|:---:|:---:|:---:|
| **Monetary policy** | 8.5 | +250 | +120 | +10% | +150 |
| **Credit** | 8.0 | -50 | +350 | +20% | +50 |
| **Macroeconomic** | 7.5 | +150 | +250 | +15% | +200 |
| **Commodities** | 7.0 | +100 | +150 | +15% | +300 |
| **Geopolitical** | 7.0 | +100 | +200 | +25% | +150 |
| **Sector outlook** | 6.0 | -50 | +180 | +15% | +50 |
| **Earnings** | 5.5 | -30 | +150 | +10% | -50 |
| **Regulatory** | 5.0 | +20 | +120 | +15% | +50 |

---

### 2. Portfolio Transmission Sensitivity ($T_{\text{port}}$)
Computes weighted transmission across asset class exposure weights $w_A$ and Category Sensitivity matrix $W_{\text{cat, asset}}$:
$$T_{\text{port}} = \sum_{A \in \{\text{LOANS, BONDS, DERIVATIVES, EQUITY}\}} \left( w_A \times W_{\text{cat}, A} \right)$$

---

### 3. Effective Exposure ($E_{\text{effective}}$)
$$E_{\text{effective}} = \begin{cases} 
E_{\text{direct}}, & \text{for DIRECT relevance} \\
E_{\text{indirect}}, & \text{for INDIRECT relevance} \\
1.0, & \text{for PORTFOLIO-WIDE relevance} \\
0.0, & \text{for IRRELEVANT events}
\end{cases}$$

---

### 4. Vulnerability Multiplier ($V_{\text{port}}$) & Portfolio Impact ($I_{\text{portfolio}}$)
$$V_{\text{port}} = E_{\text{effective}} \times T_{\text{port}} \times C_{\text{conc}} \times H_{\text{mult}} \times R_{\text{mult}}$$
$$I_{\text{raw}} = 1.0 + (S_{\text{event}} - 1.0) \times V_{\text{port}}$$
$$I_{\text{portfolio}} = \text{clamp}\left(1.0, 10.0, \text{round}(I_{\text{raw}}, 2)\right)$$

> **Note**: $T_{\text{port}}$ appears **exactly once** in $V_{\text{port}}$, guaranteeing zero $T_{\text{port}}^2$ double counting.

---

### 5. Stress Parameter Shocks
$$\text{severityScale} = \frac{S_{\text{event}}}{10.0}$$
$$E_{\text{stress}} = E_{\text{effective}} \times T_{\text{port}} \times R_{\text{stress}}$$
$$\text{ParamShock} = \text{Math.round}\left(\text{BaseShock} \times \text{severityScale} \times E_{\text{stress}} \times H_{\text{mult}}\right)$$

---

### 6. Production Financial Loss Engine (`RiskEngineService`)
Given generated integer parameters (`rate`, `spread`, `liquidity`, `inflation`), loss shifts are converted to decimals ($\text{rateShift} = \text{rate}/100$) and applied directly to baseline portfolio exposures:

$$\text{loansLoss} = \text{loansExposure} \times \left(0.4 \times \text{spreadShift} + 0.1 \times \text{rateShift}\right)$$
$$\text{bondsLoss} = \text{bondsExposure} \times \left(0.5 \times \text{rateShift} + 0.2 \times \text{spreadShift}\right)$$
$$\text{derivativesLoss} = \text{derivativesExposure} \times \left(0.6 \times \text{liquidityHaircut} + 0.2 \times \text{rateShift}\right)$$
$$\text{equityLoss} = \text{equityExposure} \times \left(0.2 \times \text{rateShift} + 0.3 \times \text{inflationShift} + 0.1 \times \text{liquidityHaircut}\right)$$
$$\text{totalLoss} = \max\left(0, \text{loansLoss} + \text{bondsLoss} + \text{derivativesLoss} + \text{equityLoss}\right)$$
$$\text{riskScore} = \min\left(100, \text{round}\left(\frac{\text{totalLoss}}{\text{baselineValue}} \times 100 \times 5\right)\right)$$

---

## 🛠 Technology Stack

| Layer | Component / Technology | Specific Purpose in VANTAGE |
|---|---|---|
| **Frontend UI** | React 19, TypeScript 5.6, Vite 8 | Dynamic risk intelligence dashboards, executive dialogs, interactive sliders |
| **Styling** | Vanilla CSS, Tailwind CSS v4 | Glassmorphism UI, high-contrast dark theme, custom responsive data grids |
| **Backend Service** | Node.js (v18+), Express 5 | REST API routing, RSS ingestion orchestrator, Prisma ORM service |
| **Database** | PostgreSQL (Neon Cloud Platform) | Persistent `RiskEvent`, `Portfolio`, `Asset`, `Scenario`, `StressTestRun` models |
| **Local Sentiment NLP** | FinBERT ONNX (`@xenova/transformers`) | Continuous financial sentiment $s \in [-1, +1]$ and confidence scoring |
| **Local Event Classifier** | Event Classifier ONNX (`@xenova/transformers`) | 8-class event taxonomy prediction & top-2 candidate confidence scores |
| **Semantic AI Provider** | Google Gen AI SDK (`gemini-3.8-flash`) | Optional semantic enrichment (entities, signals, drivers, risk flow steps) |
| **Risk Engine** | Pure TypeScript (`DeterministicRiskEngine`) | Deterministic severity, vulnerability, impact score, and parameter shocks |
| **Loss Calculations** | `RiskEngineService` | Financial duration/spread loss execution & dynamic asset attribution |
| **Test Runner** | `tsx` runner scripts (`backend/tests/run-all.ts`) | Automated test execution for property invariants, integration & E2E PostgreSQL flows |

---

## 📂 Repository Organization

```text
financial-risk-intelligence-platform/
├── README.md                            # Primary Judge-Facing Landing Page & Architecture
├── docs/                                # Technical Specifications & API Documentation
│   ├── ARCHITECTURE.md                  # Comprehensive Component & Mathematical Pipeline Specification
│   └── API.md                           # Complete REST API Endpoint Reference & Payload Schemas
├── backend/                             # Backend Service Root
│   ├── README.md                        # Backend Setup, Ingestion, and Developer Guide
│   ├── models/nlp/                      # Production Local ONNX Model Artifacts
│   │   ├── README.md                    # Model Provenance, Quantization Specs & Tokenizer Docs
│   │   ├── phase1d-finbert/             # FinBERT ONNX weights & tokenizer
│   │   └── phase2-event-classifier/     # Event Classifier ONNX weights & tokenizer
│   ├── prisma/                          # Database Configuration
│   │   ├── migrations/                  # Versioned PostgreSQL migration scripts
│   │   ├── schema.prisma                # Relational data schema (RiskEvent, Portfolio, Asset, Run)
│   │   └── seed.ts                      # Initial portfolio & baseline holdings seed script
│   ├── src/                             # Express Application Source Code
│   │   ├── config/                      # Configuration Tables
│   │   │   └── risk-engine.config.ts    # Centralized Calibration Matrices & Shock Definitions
│   │   ├── controllers/                 # HTTP Request Controllers
│   │   │   └── api.controller.ts        # Endpoint payload validation & response formatting
│   │   ├── ingestion/                   # Data Ingestion Engine
│   │   │   ├── adapters/                # RSS Feed & HTML Source Adapters
│   │   │   ├── deduplication/           # SHA-256 Hashing & Title Deduplication
│   │   │   └── ingestion.service.ts     # Multi-source Ingestion Manager
│   │   ├── providers/nlp/               # NLP Inference Providers
│   │   │   ├── finbert-sentiment.analyzer.ts # Local FinBERT ONNX Analyzer
│   │   │   ├── financial-context.ts     # Contextual Adjustment Rules
│   │   │   ├── phase2-event-classifier.ts    # Local ONNX Event Classifier Engine
│   │   │   ├── gemini-nlp.provider.ts   # Optional Gemini AI Provider
│   │   │   ├── development-nlp.provider.ts# Offline Fallback Rule Engine
│   │   │   └── nlp.service.ts           # Hybrid Orchestrator & Deterministic Engine Wiring
│   │   ├── routes/                      # API Routing Specifications
│   │   │   └── api.routes.ts            # REST endpoint routes table
│   │   ├── services/                    # Domain Services
│   │   │   ├── events/                  # Event querying and persistence
│   │   │   ├── portfolios/              # Portfolio exposures and holdings management
│   │   │   ├── scenarios/               # Macro scenario parameters generation
│   │   │   ├── allocations/             # Index allocation optimization service
│   │   │   └── risk-engine/             # Core Quantitative Risk Engines
│   │   │       ├── deterministic-risk-engine.ts # Pure Deterministic Portfolio Impact Engine
│   │   │       └── risk-engine.service.ts       # Production Financial Loss Engine & Attribution
│   │   └── server.ts                    # Express Web Server Initialization
│   └── tests/                           # Verification Test Suites
│       ├── run-all.ts                   # Master Test Suite Orchestration Script
│       ├── data/                        # Static Evaluation Datasets
│       ├── test-deterministic-risk-engine.ts # 19 Property Invariants Test Suite
│       ├── test-deterministic-e2e.ts    # End-to-End PostgreSQL Integration Test
│       ├── test-phase1d-integration.ts  # FinBERT ONNX Integration Tests
│       ├── test-phase2-integration.ts  # Event Classifier ONNX Integration Tests
│       ├── test-real-ingestion-flow.ts  # Real Ingestion & DB Persistence Test
│       ├── test-api.ts                  # API Endpoint Integration Tests
│       └── test-nlp-pipeline.ts         # Validation Bounds & Error Tests
├── src/                                 # Frontend Web Application (React 19 + TypeScript)
│   ├── App.tsx                          # App Routing & Global Shell
│   ├── main.tsx                         # React Virtual DOM Mounting Point
│   ├── index.css                        # Glassmorphism & High-Contrast Design Tokens
│   ├── api.ts                           # Axios API Client & Error Interceptors
│   ├── types.ts                         # Shared Frontend Interface Definitions
│   ├── utils.ts                         # Formatting, Math, and Calculation Utilities
│   ├── components/                      # UI Components
│   │   ├── common/                      # Reusable Buttons, Icons, Sliders, Titles
│   │   ├── risk-intelligence/           # Event Cards, Distribution Bars, Explainability Dialogs
│   │   └── stress-testing/              # WhyLossDialog, AssetLossDialog, Scenario Controls
│   └── pages/                           # Application Pages
│       ├── RiskIntelligence.tsx         # Real-Time Event Feed & Portfolio Filtering
│       ├── PortfolioStressTesting.tsx   # Interactive Event-Driven Stress Simulation
│       ├── Scenarios.tsx                # Macro Scenario Library & Custom Stress Controls
│       ├── IndexAllocation.tsx          # Sentiment-Adjusted Index Rebalancing
│       ├── Overview.tsx                 # Executive Risk Overview & Top Exposures
│       └── PortfolioSetupPage.tsx       # Portfolio Exposure Calibration UI
├── vite.config.ts                       # Vite 8 Build Configuration
└── package.json                         # Root Dependencies & Build Scripts
```

---

## ⚙️ Installation & Quick Start Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher (v20+ recommended)
- **npm**: `v9.0.0` or higher
- **PostgreSQL**: Neon Cloud PostgreSQL connection string or local PostgreSQL instance (`v14+`)

---

### Step 1: Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/mythrhyth/vantage.git
cd vantage

# Install Root (Frontend) Dependencies
npm install

# Install Backend Dependencies
cd backend
npm install
cd ..
```

---

### Step 2: Configure Environment Variables

Create `.env` inside `backend/` directory by copying `.env.example`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your actual configuration:

```env
# PostgreSQL Database Connection String
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@YOUR_NEON_HOST/neondb?sslmode=require"

# Server Port
PORT=3000

# Optional Google Gemini AI API Key (For Semantic Enrichment)
GEMINI_API_KEY="your_actual_gemini_api_key_here"

# Primary NLP Provider ('gemini' or 'development')
NLP_PROVIDER=gemini
```

*Note: Even without a `GEMINI_API_KEY`, VANTAGE runs 100% of numerical risk calculations locally via fine-tuned FinBERT ONNX and Event Classifier ONNX models.*

---

### Step 3: Initialize Database Schema & Seed Data

```bash
cd backend

# Push database schema to PostgreSQL
npx prisma db push

# Seed initial baseline portfolio and holdings
npx prisma db seed

cd ..
```

---

### Step 4: Start Backend & Frontend Application

#### Terminal 1 — Backend Express API Server
```bash
cd backend
npm run dev
```
*Backend server will start on `http://localhost:3000`*

#### Terminal 2 — Frontend React 19 Client
```bash
# In project root directory
npm run dev
```
*Frontend client will start on `http://localhost:5173` (or `http://localhost:8443`)*

---

## 📡 API Quick Reference

Complete request and response JSON schemas are documented in [`docs/API.md`](docs/API.md).

| Method | Endpoint Path | Description |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Query ingested risk events (filters: `portfolioId`, `category`, `source`, `sentiment`, `impact`) |
| `GET` | `/api/events/:id` | Fetch event details, ONNX confidence scores, signals, and canonical source link |
| `POST` | `/api/events/analyze` | Submit custom text for FinBERT + Event Classifier ONNX classification & risk analysis |
| `POST` | `/api/ingest` | Trigger manual news ingestion cycle across AP News, Reuters, Fed, ECB, and CNBC |
| `GET` | `/api/portfolios` | List portfolios and baseline valuation (`baselineValue`) |
| `PUT` | `/api/portfolios/:id` | Update portfolio baseline valuation and asset-class exposures |
| `PUT` | `/api/portfolios/:id/holdings` | Update equity holdings and stock weights |
| `POST` | `/api/stress-tests/generate-parameters` | Generate deterministic stress parameters for a selected risk event |
| `POST` | `/api/stress-tests/run` | Execute portfolio stress test, compute loss attribution, and save run history |
| `GET` | `/api/stress-tests/history` | Retrieve historical stress test run logs |

---

## 🧪 Automated Test Suite & Empirical Verification

VANTAGE includes a comprehensive automated test suite covering unit property invariants, ONNX local model inference, real database integration, and API route contracts.

### Executing the Test Suite
```bash
cd backend
npm test
```


---

## ⚠️ Limitations & Responsible Analytical Use

1. **Simplified Financial Formulas**: Financial loss calculations use standardized fixed-income duration and spread approximations. They represent analytical model stress outputs, not guaranteed market loss predictions or professional investment advice.
2. **Scope of Entity Resolution**: Portfolio relevance matching relies on ticker, company name, and sector keyword matching against ingested headlines. Complex corporate subsidiary tree resolution requires further expansion.
3. **Data Source Dependency**: Live news ingestion depends on public RSS feeds from AP, Reuters, Bloomberg, Fed, ECB, and CNBC. Network connectivity or feed structural changes may affect ingestion freshness.

---

## 🔮 Future Engineering Roadmap

- [ ] **Multi-Asset Derivative Pricing Models**: Expand options and swap valuation formulas to include implied volatility surface shifts ($\Delta \sigma$).
- [ ] **Historical Backtesting Engine**: Replay historical macroeconomic crises (e.g. 2008 Financial Crisis, 2020 Liquidity Shock) against active portfolio configurations.
- [ ] **Enterprise Role-Based Access Control (RBAC)**: Multi-tenant portfolio management with custom organization risk limits and audit trails.

---

## 📜 Credits & Licensing

- **License**: Open-source under the [ISC License](LICENSE).
- **Core Models & Frameworks**:
  - [Hugging Face Transformers / transformers.js](https://github.com/xenova/transformers.js) for local browser/Node.js ONNX inference.
  - [ProsusAI/finbert](https://huggingface.co/ProsusAI/finbert) for baseline financial sentiment architecture.
  - [Prisma ORM](https://www.prisma.io/) & [Neon Cloud PostgreSQL](https://neon.tech/) for serverless database infrastructure.
