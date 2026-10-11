# VANTAGE — Deterministic & Portfolio-Aware Financial Risk Intelligence Platform

> **Transform unstructured global financial news into portfolio-aware risk signals, local ONNX-driven event classification, and deterministic, calculation-backed stress loss attribution.**

[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-v20.19%2B-green.svg?logo=nodedotjs)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react)](https://react.dev/)
[![ONNX Runtime](https://img.shields.io/badge/ONNX_Runtime-v2.17.2-orange.svg?logo=onnx)](https://onnxruntime.ai/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-336791.svg?logo=postgresql)](https://neon.tech/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22.0-2D3748.svg?logo=prisma)](https://www.prisma.io/)
[![Build & Test](https://img.shields.io/badge/Test_Suite-100%25_Passing-brightgreen.svg)]()

---

### Project Snapshot

- Converts financial news into portfolio-aware risk signals using local ONNX NLP + deterministic quant risk modeling.
- Quantifies event severity, transmission impact, and asset-class loss attribution without relying on opaque LLM-generated numbers.
- Designed for macro risk teams, portfolio managers, and executive dashboards that need auditable risk explanations.
- Built as a full-stack TypeScript prototype with a React frontend, Express backend, PostgreSQL persistence, and local model execution.

## 📌 Table of Contents
- [S&P Global & Crisil Campus Hackathon Submission](#hackathon-submission)
- [Executive Summary & Core Value Proposition](#executive-summary)
- [The Problem](#problem)
- [What Makes VANTAGE Different? (Unique Selling Proposition)](#usp)
- [End-to-End System Architecture](#architecture)
- [Dataset Used](#dataset-used)
- [Technology Stack](#technology-stack)
- [Installation & Quick Start Guide](#installation)
- [Automated Test Suite & Empirical Verification](#tests)
- [Limitations & Responsible Analytical Use](#limitations)
- [Future Engineering Roadmap](#roadmap)
- [Credits & Licensing](#credits)

---

<a id="hackathon-submission"></a>
## S&P Global & Crisil Campus Hackathon Submission

- **Candidate Name:** Rhythm Bhetwal
- **College Email ID:** b24cs038@nitm.ac.in
- **College / Campus:** NIT Meghalaya National Institute of Technology (NIT) Meghalaya
- **Demo Video Link:** To be recorded; add a publicly accessible unlisted YouTube link once finalized.
- **Slide Deck:** [`docs/presentation.pdf`](docs/presentation.pdf) (7-slide draft)
- **Status:** Submitted for evaluation and continuously refined through local validation and risk-model verification.


---

<a id="executive-summary"></a>
## 💡 Executive Summary & Core Value Proposition

Financial risk management teams and portfolio managers face an overwhelming volume of daily macroeconomic headlines, central bank announcements, and sector shocks. Traditional financial dashboards either rely on **generic sentiment scores** (which treat all negative news equally regardless of portfolio composition) or rely on **black-box LLMs** to hallucinate numerical financial loss figures.

**VANTAGE** bridges the gap between unstructured financial NLP and rigorous financial quantitative risk modeling. By combining **fine-tuned local ONNX models** (FinBERT for continuous sentiment and fine-tuned ONNX for 8-class event taxonomy) with a **pure Deterministic Risk Engine**, VANTAGE translates real-time financial market signals directly into portfolio-specific exposure shifts, macro stress parameters (`rate`, `spread`, `liquidity`, `inflation`), and calculation-backed asset-class loss attribution.

---

<a id="problem"></a>
## 📉 The Problem

Existing financial risk intelligence workflows suffer from four fundamental architectural limitations:

1. **Sentiment Disconnect**: Negative sentiment does not automatically equal high financial loss. A 50 bps rate hike headline has a drastically different impact on a 80% fixed-income portfolio versus an 80% technology equity portfolio.
2. **LLM Hallucination in Numerical Risk**: Asking a generative LLM to output a financial loss estimate (e.g. *"predict the loss in Crore INR"*) yields non-deterministic, uncalibrated numbers that violate financial duration and spread sensitivities.
3. **Lack of Exposure Filtering**: General news aggregators alert managers to market events that are completely irrelevant to their actual holdings or sector concentrations.
4. **Opaque Black-Box Attribution**: Risk managers cannot audit or explain static prototype percentages (e.g., hardcoded 47% Loan / 31% Bond splits) to executive committees when market shocks occur.

---

<a id="usp"></a>
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

<a id="architecture"></a>
## 🏗 End-to-End System Architecture

![VANTAGE End-to-End System Architecture Pipeline](docs/assets/architecture_flow.svg)

<details>
<summary><b> View Editable Mermaid Source Code</b></summary>

```mermaid
flowchart TD
    subgraph Ingestion ["1. Multi-Source Financial Ingestion"]
        A1[AP News / Reuters / Bloomberg / Economic Times / Mint / Moneycontrol] --> B[Ingestion Orchestrator]
        A2[ECB / Federal Reserve / CNBC / Business Standard / CNBC TV18] --> B
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

<a id="dataset-used"></a>
## 🧠 Dataset Used

VANTAGE uses financial NLP datasets for model development and evaluation, along with locally maintained synthetic JSON fixtures for application-level testing and validation.

### 3.1 Financial NLP Datasets

| Dataset | Purpose | Link |
|---|---|---|
| **Financial PhraseBank** | Financial sentiment classification into positive, neutral, and negative categories. Used for fine-tuning and evaluating the sentiment classifier. | [Hugging Face – Financial PhraseBank](https://huggingface.co/datasets/takala/financial_phrasebank) |
| **Twitter Financial News Topic** (`zeroshot/twitter-financial-news-topic`) | Financial event classification. Used to develop the event classifier, with labels mapped to eight financial event categories. | [Hugging Face – Twitter Financial News Topic](https://huggingface.co/datasets/zeroshot/twitter-financial-news-topic) |

> Synthetic test fixtures are maintained locally for stress-testing the application pipeline, portfolio scenarios, and API behavior without depending on external data during CI or local QA runs.

### Short model-evaluation snapshot

VANTAGE runs a two-stage local NLP pipeline: FinBERT for sentiment and a fine-tuned event classifier for eight financial categories. In the recorded evaluation notes, the sentiment classifier reached 91.05% accuracy and the event classifier reached 95.12% accuracy, with 97.60% top-2 accuracy. The detailed deterministic risk equations and model-evaluation methodology are documented in [architecture.md](architecture.md).

> Note: the recorded benchmarking numbers should be validated against the saved evaluation outputs before being treated as reproduced benchmarks.

---

<a id="technology-stack"></a>
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

<a id="installation"></a>
## ⚙️ Installation & Quick Start Guide

Deployment is out of scope for this local hackathon prototype. Follow the local setup instructions below to run VANTAGE.

### Prerequisites
- **Node.js**: `v20.19.0` or higher for the Vite 8 frontend
- **npm**: `v9.0.0` or higher
- **Git LFS**: required to download the tracked ONNX model weights
- **PostgreSQL**: Neon Cloud PostgreSQL connection string or local PostgreSQL instance (`v14+`)

---

### Step 1: Clone Repository & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/mythrhyth/vantage.git
cd vantage
git lfs pull

# Install Root (Frontend) Dependencies
npm ci

# Install Backend Dependencies
cd backend
npm ci
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
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"

# Server Port
PORT=3000

# Optional Google Gemini AI API Key (For Semantic Enrichment)
GEMINI_API_KEY="your_actual_gemini_api_key_here"

# Primary NLP Provider ('gemini' or 'development')
NLP_PROVIDER=development
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

<a id="tests"></a>
## 🧪 Automated Test Suite & Empirical Verification

VANTAGE includes a comprehensive automated test suite covering unit property invariants, ONNX local model inference, real database integration, and API route contracts.

### Executing the Test Suite
```bash
cd backend
npm test
```


---

<a id="limitations"></a>
## ⚠️ Limitations & Responsible Analytical Use

1. **Simplified Financial Formulas**: Financial loss calculations use standardized fixed-income duration and spread approximations. They represent analytical model stress outputs, not guaranteed market loss predictions or professional investment advice.
2. **Scope of Entity Resolution**: Portfolio relevance matching relies on ticker, company name, and sector keyword matching against ingested headlines. Complex corporate subsidiary tree resolution requires further expansion.
3. **Data Source Dependency**: Live news ingestion depends on public RSS feeds from AP, Reuters, Bloomberg, Fed, ECB, and CNBC. Network connectivity or feed structural changes may affect ingestion freshness.

---

<a id="roadmap"></a>
## 🔮 Future Engineering Roadmap

- [ ] **Multi-Asset Derivative Pricing Models**: Expand options and swap valuation formulas to include implied volatility surface shifts ($\Delta \sigma$).
- [ ] **Historical Backtesting Engine**: Replay historical macroeconomic crises (e.g. 2008 Financial Crisis, 2020 Liquidity Shock) against active portfolio configurations.
- [ ] **Enterprise Role-Based Access Control (RBAC)**: Multi-tenant portfolio management with custom organization risk limits and audit trails.

---

<a id="credits"></a>
## 📜 Credits & Licensing

- **License**: Open-source under the [ISC License](LICENSE).
- **Core Models & Frameworks**:
  - [Hugging Face Transformers / transformers.js](https://github.com/xenova/transformers.js) for local browser/Node.js ONNX inference.
  - [ProsusAI/finbert](https://huggingface.co/ProsusAI/finbert) for baseline financial sentiment architecture.
  - [Prisma ORM](https://www.prisma.io/) & [Neon Cloud PostgreSQL](https://neon.tech/) for serverless database infrastructure.
