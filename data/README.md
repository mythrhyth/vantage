# Demo and Evaluation Data

These JSON fixtures are synthetic, hand-authored examples included for local evaluation and reproducible tests. They are not copied from live news feeds, S&P Global, Crisil, or any client engagement. Public company and ticker names appear in some examples only to exercise entity and portfolio matching; numeric claims and headline scenarios are illustrative and should not be treated as real reporting.

| File | Contents | Used for |
|---|---|---|
| `financial-dev-dataset.json` | Labeled short financial-news examples | Development/evaluation inputs |
| `financial-benchmark-100.json` | 100 labeled sentiment and event examples | FinBERT evaluation and pipeline integrity checks |
| `entity-relevance-benchmark-50.json` | 50 event examples with expected entities, assets, and relevance | Portfolio entity-resolution evaluation |

Labels are curated test expectations, not third-party ground truth. The datasets do not contain real portfolio holdings, customer information, or confidential data.
