import React, { useState, useEffect } from "react"
import { Button } from "../common/Button"
import { ModalDialog } from "../common/ModalDialog"

interface ScenarioConfig {
  id: string
  name: string
  rate: number
  spread: number
  probability: number
  liquidity: number
  inflation: number
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
  const [availableScenarios, setAvailableScenarios] = useState<ScenarioConfig[]>([])
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([])
  const [results, setResults] = useState<Record<string, ComparisonRow>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const runComparisons = async () => {
    if (availableScenarios.length === 0 || selectedScenarios.length === 0) return
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
          const config = availableScenarios.find(scenario => scenario.name === name)
          if (!config) return

          try {
            const res = await riskApi.runStressTest(targetId!, {
              rate: config.rate,
              spread: config.spread,
              probability: config.probability,
              liquidity: config.liquidity,
              inflation: config.inflation
            }, undefined, undefined, false, 'preset')
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
    let cancelled = false
    import("../../services/api").then(({ riskApi }) => riskApi.getScenarios())
      .then(scenarios => {
        if (cancelled) return
        if (scenarios.length === 0) {
          setLoadError("No saved scenario configurations are available.")
          setLoading(false)
          return
        }
        setAvailableScenarios(scenarios)
        setSelectedScenarios(scenarios.slice(0, Math.min(4, scenarios.length)).map(scenario => scenario.name))
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(`Failed to load saved scenarios: ${error.message}`)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    runComparisons()
  }, [selectedScenarios, portfolioId, availableScenarios])

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
    <ModalDialog
      className="scenario-compare-dialog"
      labelledBy="scenario-compare-title"
      describedBy="scenario-compare-description"
      onClose={onClose}
    >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Scenario comparison</span>
            <div className="dialog-title" id="scenario-compare-title">
              Compare scenarios
            </div>
            <span className="dialog-meta" id="scenario-compare-description">
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
            {availableScenarios.map(({ name }) => (
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
            ) : loadError ? (
              <div role="alert" className="empty-state" style={{ padding: "32px", textAlign: "center" }}>
                {loadError}
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
    </ModalDialog>
  )
}
