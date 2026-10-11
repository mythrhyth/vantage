# VANTAGE Architecture & Risk Model

This document captures the detailed risk model and the NLP evaluation setup used by VANTAGE.

## 1. Deterministic Risk Model

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

> Note: $T_{\text{port}}$ appears exactly once in $V_{\text{port}}$, guaranteeing zero $T_{\text{port}}^2$ double counting.

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

## 2. NLP Models & Evaluation Results

VANTAGE uses a two-model financial NLP pipeline built around FinBERT to interpret financial news before passing structured signals to its deterministic portfolio-risk engine.

### 2.1 Financial Sentiment Classifier

- **Base model:** [ProsusAI/FinBERT](https://huggingface.co/ProsusAI/finbert)
- **Dataset:** [Financial PhraseBank](https://huggingface.co/datasets/takala/financial_phrasebank)
- **Task:** Classifies financial text as positive, neutral, or negative.
- **Fine-tuning:** Fine-tuned using Financial PhraseBank, as documented in the model evaluation notes.

| Evaluation Metric | Result |
|---|---:|
| Evaluation samples | 726 |
| Accuracy | 91.05% |
| Macro F1-score | 90.46% |
| Positive-class F1 | 87.77% |
| Neutral-class F1 | 92.69% |
| Negative-class F1 | 90.91% |
| Average inference latency | 10.02 ms/sample |

### 2.2 Financial Event Classifier

- **Base architecture:** ProsusAI/FinBERT
- **Dataset:** `zeroshot/twitter-financial-news-topic`
- **Task:** Classifies financial news into eight event categories.
- **Deployment format:** FP32 ONNX for local inference.

| Evaluation Metric | Result |
|---|---:|
| Evaluation samples | 2,375 |
| Accuracy | 95.12% |
| Macro F1-score | 92.81% |
| Weighted F1-score | 95.14% |
| Top-2 accuracy | 97.60% |
| Expected Calibration Error (ECE) | 0.0568 |
| Average inference latency | 8.38 ms/item |

**Event categories:** Monetary Policy, Credit, Commodities, Earnings, Sector Outlook, Geopolitical, Regulatory, and Macroeconomic.

The recorded dataset size for the event-classification dataset is 21,107 examples; the 2,375 figure above represents the total support in the documented evaluation results, not the full dataset size.

### 2.3 ONNX Inference Verification

The project evaluation notes report a comparison of 2,375 predictions between the reference model and its ONNX version, with zero label mismatches and a maximum probability difference below 0.00005.

These figures describe the recorded comparison and should be verified against the saved evaluation outputs before being treated as a reproduced benchmark.

---

## 3. Implementation Notes

- The purpose of the risk model is to translate model outputs into explainable, deterministic risk shocks.
- The NLP components provide classification and sentiment information; the quant engine computes severity, exposure, and portfolio impact.
- This document should be treated as the design source for the deterministic financial logic and the recorded evaluation narrative.
