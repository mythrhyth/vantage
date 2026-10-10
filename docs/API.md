# VANTAGE REST API Reference Specification

> **Complete endpoint definitions, request headers, query parameters, and JSON payload schemas for the VANTAGE REST API.**

---

## 📌 Base URL & Headers

```http
Base URL: http://localhost:3000/api
Content-Type: application/json
```

---

## 1. Risk Events & NLP Endpoints

### `GET /api/events`
Query ingested risk events with optional portfolio relevance, category, source, and metric filtering.

#### Query Parameters
- `portfolioId` (string): Filter events by relevance to portfolio ID.
- `category` (string): Filter by 8 canonical event categories (e.g. `Monetary policy`, `Credit`, `Macroeconomic`).
- `source` (string): Filter by news source (e.g. `Reuters`, `Federal Reserve`, `AP News`).
- `sentiment` (string): `positive`, `negative`, or `neutral`.
- `impact` (string): Minimum portfolio impact score ($1 - 10$).

#### Response `200 OK`
```json
[
  {
    "id": "acc24d52-a6d7-46d0-ad16-3725c43e9cf1",
    "title": "Federal Reserve Raises Benchmark Interest Rates by 50 bps",
    "entity": "Federal Reserve",
    "category": "Monetary policy",
    "classificationConfidence": 0.9535,
    "sentiment": 0.2406,
    "sentimentConfidence": 0.599,
    "impact": 4.58,
    "impactConfidence": 0.8582,
    "source": "Reuters",
    "excerpt": "The Federal Reserve announced an aggressive 50 basis point rate hike...",
    "createdAt": "2026-10-09T00:00:00.000Z"
  }
]
```

---

### `GET /api/events/:id`
Fetch detailed metadata for a specific risk event including local ONNX classification probabilities, signals, drivers, and canonical source link.

#### Response `200 OK`
```json
{
  "id": "acc24d52-a6d7-46d0-ad16-3725c43e9cf1",
  "title": "Federal Reserve Raises Benchmark Interest Rates by 50 bps",
  "entity": "Federal Reserve",
  "category": "Monetary policy",
  "classificationConfidence": 0.9535,
  "sentiment": 0.2406,
  "sentimentConfidence": 0.599,
  "impact": 4.58,
  "impactConfidence": 0.8582,
  "impactReason": "[Deterministic Engine: S_event=7.78, I_portfolio=4.58, E_stress=0.4970]",
  "classificationReason": "[Phase 2 Classifier: Monetary policy (95.4% conf)]",
  "signals": ["Rate Hike +50bps", "Yield Curve Shift"],
  "sentimentDrivers": ["Persistent Inflationary Pressures"],
  "source": "Reuters",
  "excerpt": "The Federal Reserve announced an aggressive 50 basis point rate hike...",
  "horizon": "1-4 weeks",
  "affectedAssets": ["BONDS", "LOANS"],
  "relevanceType": "PORTFOLIO_WIDE",
  "relevanceScore": 1.0
}
```

---

### `POST /api/events/analyze`
Submit custom financial news text for Phase 1D FinBERT sentiment analysis, Phase 2 ONNX classification, and deterministic risk impact calculation.

#### Request Body
```json
{
  "title": "ECB Signals Rate Cuts Amid Slowing Industrial Output",
  "source": "ECB Wire",
  "text": "The European Central Bank indicated potential rate reductions following three consecutive quarters of contracting industrial production in Germany.",
  "publishedAt": "2026-10-09T10:00:00Z"
}
```

#### Response `201 Created`
```json
{
  "id": "e4f8b91a-1234-4567-89ab-cdef01234567",
  "title": "ECB Signals Rate Cuts Amid Slowing Industrial Output",
  "category": "Monetary policy",
  "classificationConfidence": 0.9412,
  "sentiment": -0.8171,
  "sentimentConfidence": 0.8204,
  "impact": 5.75,
  "impactConfidence": 0.7721,
  "source": "ECB Wire",
  "createdAt": "2026-10-09T10:00:01.000Z"
}
```

---

## 2. Ingestion Endpoints

### `POST /api/ingest`
Trigger a manual news ingestion cycle across configured RSS feeds.

#### Response `200 OK`
```json
{
  "status": "success",
  "ingestedCount": 12,
  "deduplicatedCount": 4,
  "timestamp": "2026-10-09T10:05:00.000Z"
}
```

### Ingestion source configuration

The default RSS sources are inserted into the database only when their IDs are missing. Existing database settings remain authoritative, and sources created or updated through these endpoints are used by later ingestion cycles. The background worker respects each enabled source's fetch interval; a manual `POST /api/ingest` run fetches every enabled source immediately.

#### `GET /api/ingestion/sources`
List configured sources and their current enabled state, feed URL, interval, and per-run item limit.

#### `POST /api/ingestion/sources`
Add a database-backed RSS source.

```json
{
  "name": "Example Financial News",
  "domain": "https://example.com",
  "sourceType": "Financial News",
  "feedUrl": "https://example.com/rss",
  "enabled": true,
  "fetchInterval": 15,
  "maxItemsPerRun": 20
}
```

`name`, `domain`, `sourceType`, and `feedUrl` are required. URLs must use HTTP or HTTPS. `fetchInterval` defaults to 15 minutes; `maxItemsPerRun` defaults to 20 and must be between 1 and 100.

#### `PUT /api/ingestion/sources/:id`
Update any provided source fields from the create payload. Existing settings not included in the request are preserved.

#### `PATCH /api/ingestion/sources/:id`
Set the source's `enabled` state.

---

## 3. Portfolios & Holdings Endpoints

### `GET /api/portfolios`
List active portfolios, baseline valuation, asset-class exposures, and holdings.

#### Response `200 OK`
```json
[
  {
    "id": "204791e9-2a8f-4366-a258-bb6484ddb2df",
    "name": "Main Wealth Fund Portfolio",
    "baselineValue": 3000.0,
    "indexUniverse": "NIFTY50",
    "loansExposure": 1500.0,
    "bondsExposure": 900.0,
    "derivativesExposure": 300.0,
    "equityExposure": 300.0,
    "holdings": [
      {
        "id": "7b2ac86e-0cbf-44d5-b66e-ab96c94a0ccf",
        "ticker": "AAPL",
        "company": "Apple Inc.",
        "assetType": "EQUITY",
        "sector": "Technology",
        "currentWeight": 5.0,
        "exposureValue": 150.0
      }
    ]
  }
]
```

---

### `PUT /api/portfolios/:id`
Update portfolio baseline valuation, asset-class exposures, and optionally its equity holdings as one atomic operation. The baseline remains authoritative; all constituent exposures must reconcile to it within ₹1 Cr or the request is rejected.

#### Request Body
```json
{
  "baselineValue": 3500.0,
  "loansExposure": 1750.0,
  "bondsExposure": 1050.0,
  "derivativesExposure": 350.0,
  "holdings": [
    {
      "ticker": "RELIANCE",
      "company": "Reliance Industries Ltd",
      "sector": "Energy",
      "currentWeight": 10.0
    }
  ]
}
```

Equity weights are percentages of the configured baseline. The request is saved transactionally so the portfolio metadata and constituent assets cannot be left partially updated. Existing seeded portfolio data is preserved by subsequent seed runs. The `20261010125000_reconcile_portfolio_seed_exposures` migration reconciles legacy constituent exposure totals to their configured baseline while preserving their relative allocation.

#### Response `200 OK`
```json
{
  "id": "204791e9-2a8f-4366-a258-bb6484ddb2df",
  "name": "Main Wealth Fund Portfolio",
  "baselineValue": 3500.0,
  "loansExposure": 1750.0,
  "bondsExposure": 1050.0,
  "derivativesExposure": 350.0
}
```

---

## 4. Stress Testing Endpoints

### `POST /api/stress-tests/generate-parameters`
Generate deterministic macro stress parameter shocks for a given risk event.

#### Request Body
```json
{
  "eventId": "acc24d52-a6d7-46d0-ad16-3725c43e9cf1"
}
```

#### Response `200 OK`
```json
{
  "rate": 97,
  "spread": 46,
  "liquidity": 4,
  "inflation": 58,
  "probability": 6
}
```

---

### `POST /api/stress-tests/run`
Execute portfolio stress test using generated or custom parameters, compute absolute loss, risk score, and dynamic asset-class attribution.

#### Request Body
```json
{
  "portfolioId": "204791e9-2a8f-4366-a258-bb6484ddb2df",
  "eventId": "acc24d52-a6d7-46d0-ad16-3725c43e9cf1",
  "parameters": {
    "rate": 97,
    "spread": 46,
    "liquidity": 4,
    "inflation": 58
  }
}
```

#### Response `200 OK`
```json
{
  "id": "389abb37-4aba-4eff-9e84-bb3b36752c52",
  "portfolioId": "204791e9-2a8f-4366-a258-bb6484ddb2df",
  "eventId": "acc24d52-a6d7-46d0-ad16-3725c43e9cf1",
  "baselineValue": 3000.0,
  "stressedValue": 1993.8,
  "absoluteLoss": 1006.2,
  "riskScore": 100,
  "attributionResult": {
    "loansLoss": 421.5,
    "bondsLoss": 519.3,
    "derivativesLoss": 65.4,
    "equityLoss": 0.0,
    "factors": [
      { "factor": "interest_rate", "loss": 145.5 },
      { "factor": "spread", "loss": 55.2 },
      { "factor": "liquidity", "loss": 3.6 },
      { "factor": "inflation", "loss": 52.2 }
    ]
  },
  "executedAt": "2026-10-09T10:10:00.000Z"
}
```
