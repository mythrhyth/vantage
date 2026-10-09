# VANTAGE Local ONNX Model Artifacts & NLP Pipeline Documentation

> **Detailed specifications for fine-tuned local ONNX models powering VANTAGE's 100% LLM-independent financial sentiment analysis and event classification.**

---

## 📌 Architecture Overview

VANTAGE relies on local ONNX models for authoritative financial natural language processing (NLP). By executing inference locally using `@xenova/transformers` (Node.js WebAssembly / ONNX Runtime), the platform guarantees zero network latency for NLP inference, zero API quota costs, and 100% reliability even during cloud LLM service outages.

```text
backend/models/nlp/
├── phase1d-finbert/             # Phase 1D FinBERT ONNX Sentiment Analyzer
│   ├── config.json              # Model configuration (ProsusAI/finbert base)
│   ├── label_mapping.json       # Sentiment index mapping (0: positive, 1: negative, 2: neutral)
│   ├── metadata.json            # Model training & quantization metadata
│   ├── tokenizer.json           # WordPiece tokenizer vocab & rules
│   ├── tokenizer_config.json    # Tokenizer special tokens configuration
│   └── onnx/
│       └── model.onnx           # Compiled Phase 1D FinBERT ONNX Model (~438 MB)
└── phase2-event-classifier/     # Phase 2 ONNX 8-Class Event Classifier
    ├── config.json              # Model architecture configuration
    ├── label_mapping.json       # Category index mapping (8 canonical classes)
    ├── metadata.json            # Finetuning performance metrics (Macro F1: 0.9281)
    ├── tokenizer.json           # WordPiece tokenizer
    ├── tokenizer_config.json    # Tokenizer special tokens configuration
    └── onnx/
        └── model.onnx           # Compiled Phase 2 Event Classifier ONNX Model (~438 MB)
```

---

## 🧠 Model 1: Phase 1D FinBERT Sentiment Analyzer

### Specifications
- **Base Architecture**: `ProsusAI/finbert` (BERT-base-uncased adapted for financial text)
- **Runtime Engine**: `@xenova/transformers` (ONNX Runtime Node.js binding)
- **Output Metrics**:
  - Continuous sentiment score $s \in [-1.0, +1.0]$
  - Sentiment confidence $c \in [0.0, 1.0]$
  - Class probabilities: $P(\text{positive}), P(\text{negative}), P(\text{neutral})$
- **Label Index Mapping**:
  - `0`: `positive`
  - `1`: `negative`
  - `2`: `neutral`

### Score Derivation Formula
Continuous sentiment $s$ is computed from output class probabilities:
$$s = P(\text{positive}) - P(\text{negative})$$
$$\text{confidence} = \max\left(P(\text{positive}), P(\text{negative}), P(\text{neutral})\right)$$

### Runtime Code Integration
Implemented in `backend/src/providers/nlp/finbert-sentiment.analyzer.ts`. The model pipeline is loaded lazily on first request and cached in memory across subsequent API calls.

---

## 🏷️ Model 2: Phase 2 Event Classifier ONNX

### Specifications
- **Base Architecture**: Fine-Tuned BERT Sequence Classifier
- **Taxonomy Scope**: **8 Canonical Production Categories**
- **Evaluation Accuracy**: `0.9512` (PyTorch & ONNX identical predictions across test callset)
- **Macro F1 Score**: `0.9281`
- **Weighted F1 Score**: `0.9514`

### 8 Canonical Production Categories
1. **Monetary policy**: Central bank rate decisions, yield curve control, QE/QT actions.
2. **Credit**: Corporate credit downgrades, default risks, bond yield spreads.
3. **Macroeconomic**: Inflation CPI metrics, GDP growth rates, unemployment statistics.
4. **Commodities**: Crude oil price shocks, agricultural supply disruptions, metals.
5. **Geopolitical**: Trade sanctions, tariff disputes, conflict supply chain impacts.
6. **Sector outlook**: Industry-wide trends, tech subsidies, real estate adjustments.
7. **Earnings**: Corporate revenue reports, quarterly margin guidance, dividend cuts.
8. **Regulatory**: Antitrust investigations, banking capital compliance regulations.

### Output Payload
The Phase 2 ONNX analyzer emits:
- `predictedCategory`: Highest probability event category string.
- `confidence`: Probability score of top prediction $c \in [0.0, 1.0]$.
- `top2Category`: Second highest candidate category string.
- `top2Confidence`: Probability score of second candidate.
- `categoryProbabilities`: Record of all 8 class probabilities summing to $1.0$.

### Runtime Code Integration
Implemented in `backend/src/providers/nlp/phase2-event-classifier.ts`.

---

## 🔒 Verification & Quality Assurance

Both local ONNX model artifacts have been validated against original PyTorch source checkpoints:
- **PyTorch vs ONNX Prediction Identity**: 2,375 / 2,375 test predictions identical (0 label mismatches).
- **Max Probability Difference**: $< 0.000050$.
- **LLM Independence**: Serves authoritative sentiment and classification even when cloud APIs return HTTP 429/503 errors.
