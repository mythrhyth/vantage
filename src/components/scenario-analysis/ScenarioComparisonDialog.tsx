import React, { useState, useEffect } from "react"
import { ScenarioName } from "../../types"
import { Button } from "../common/Button"

const PRESET_SCENARIO_CONFIGS: Record<string, { params: any; label: string }> = {
  "Interest Rate Shock": {
    params: { rate: 250, spread: 120, liquidity: 8, inflation: 150 },
    label: "Interest Rate Shock"
  },
  "Credit Crisis": {
    params: { rate: -50, spread: 350, liquidity: 20, inflation: 50 },
    label: "Credit Crisis"
  },
  "Combined Macro Stress": {
    params: { rate: 150, spread: 250, liquidity: 15, inflation: 200 },
    label: "Combined Macro Stress"
  },
  "Equity Market Crash": {
    params: { sp: 70, technology: 60, rates: 120, inflation: 120 },
    label: "Equity Market Crash"
  },
  "Oil Shock": {
    params: { oil: 140, dollar: 115, rates: 110, inflation: 130 },
    label: "Oil Shock"
  }
}

interface ComparisonRow {
  name: string
  stressedValue: number
  loss: number
  lossPct: number
  error?: string
}

export function ScenarioComparisonDialog({
  portfolioId,
  baseline = 1000,
  onClose
}: {
  portfolioId: string | null
  baseline?: number
  onClose: () => void
}) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([
    "Interest Rate Shock",
    "Credit Crisis",
    "Combined Macro Stress",
    "Equity Market Crash"
  ])
  const [results, setResults] = useState<Record<string, ComparisonRow>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const runComparisons = async () => {
    setLoading(true)
    try {
      const { riskApi } = await import("../../services/api")
      let targetId = portfolioId
      if (!targetId) {
        const ports = await riskApi.getPortfolios().catch(() => [])
        if (ports && ports.length > 0) targetId = ports[0].id
      }
      if (!targetId) {
        setLoading(false)
        return
      }

      const newResults: Record<string, ComparisonRow> = {}

      await Promise.all(
        selectedScenarios.map(async (name) => {
          const config = PRESET_SCENARIO_CONFIGS[name]
          if (!config) return

          try {
            const res = await riskApi.runStressTest(targetId!, config.params)
            const rawLoss = Number(res.absolute_loss) || 0
            const portBaseline = Number(res.baseline_value) || baseline || 1000
            const loss = isNaN(rawLoss) ? 0 : Math.max(0, rawLoss)
            const stressedValue = Math.max(0, portBaseline - loss)
            const lossPct = portBaseline > 0 ? (loss / portBaseline) * 100 : 0

            newResults[name] = {
              name,
              stressedValue: parseFloat(stressedValue.toFixed(1)),
              loss: parseFloat(loss.toFixed(1)),
              lossPct: parseFloat(lossPct.toFixed(1))
            }
          } catch (err: any) {
            newResults[name] = {
              name,
              stressedValue: baseline,
              loss: 0,
              lossPct: 0,
              error: err?.message || "Calculation failed"
            }
          }
        })
      )

      setResults(newResults)
    } catch (err) {
      console.error("[ScenarioComparisonDialog] Error running scenario comparisons:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runComparisons()
  }, [selectedScenarios, portfolioId])

  const toggleScenario = (name: string) => {
    setSelectedScenarios((current) => {
      if (current.includes(name)) {
        return current.length > 2 ? current.filter((item) => item !== name) : current
      }
      return current.length < 4 ? [...current, name] : current
    })
  }

  const rows = selectedScenarios
    .map((name) => results[name] || { name, stressedValue: baseline, loss: 0, lossPct: 0 })
    .sort((a, b) => b.loss - a.loss)

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => input.target === input.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog scenario-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-compare-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Scenario comparison</span>
            <div className="dialog-title" id="scenario-compare-title">
              Compare scenarios
            </div>
            <span className="dialog-meta">
              Select 2 to 4 preset scenarios to compare portfolio loss severity
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close scenario comparison"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <div className="scenario-choice-grid">
            {Object.keys(PRESET_SCENARIO_CONFIGS).map((name) => (
              <Button
                key={name}
                variant="outline"
                className={selectedScenarios.includes(name) ? "selected" : ""}
                ariaPressed={selectedScenarios.includes(name)}
                onClick={() => toggleScenario(name)}
              >
                {name}
              </Button>
            ))}
          </div>
          <section className="dialog-section comparison-table-section">
            <div className="dialog-section-title">Modeled portfolio impact</div>
            {loading ? (
              <div className="empty-state" style={{ padding: "32px", textAlign: "center" }}>
                <span>Calculating scenario comparisons against risk engine...</span>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Stressed value</th>
                      <th>Loss</th>
                      <th>Loss %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr
                        className={index === 0 && row.loss > 0 ? "largest-loss-row" : ""}
                        key={row.name}
                      >
                        <td>
                          <strong>{row.name}</strong>
                          {index === 0 && row.loss > 0 && <small>Largest loss</small>}
                          {row.error && <small style={{ color: "var(--negative)" }}>{row.error}</small>}
                        </td>
                        <td>₹{row.stressedValue.toFixed(1)} Cr</td>
                        <td className={row.loss > 0 ? "negative" : ""}>
                          {row.loss > 0 ? `-₹${row.loss.toFixed(1)} Cr` : `₹0.0 Cr`}
                        </td>
                        <td className={row.loss > 0 ? "negative" : ""}>
                          {row.loss > 0 ? `-${row.lossPct.toFixed(1)}%` : `0.0%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <span className="prototype-label">
              Scenario values are evaluated using active portfolio exposures and canonical backend RiskEngineService.
            </span>
          </section>
        </div>
        <div className="explainability-footer">
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    </div>
  )
}

