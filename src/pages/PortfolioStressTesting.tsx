import React, { useState, useEffect, useCallback } from "react"
import { mappedScenarioForEvent } from "../utils"
import { Button } from "../components/common/Button"
import { Slider } from "../components/common/Slider"
import { Summary } from "../components/common/Summary"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { RiskHistogram } from "../components/risk-intelligence/RiskHistogram"

export interface PortfolioStressTestingProps {
  portfolioId: string | null
  triggerEvent: any | null
  openScenario: () => void
}

export function PortfolioStressTesting({
  portfolioId,
  triggerEvent,
  openScenario,
}: PortfolioStressTestingProps) {
  const defaultValues = {
    sp: 100,
    emerging: 100,
    technology: 100,
    oil: 100,
    gold: 100,
    dollar: 100,
    rates: 100,
    inflation: 100,
  }

  const [values, setValues] = useState(defaultValues)
  const stress = Object.values(values).reduce(
    (sum, value) => sum + Math.abs(value - 100),
    0,
  )

  const [backendResult, setBackendResult] = useState<any | null>(null)
  const [portfolioMeta, setPortfolioMeta] = useState<any | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [portfolioError, setPortfolioError] = useState<string | null>(null)
  const [lastExecutedAt, setLastExecutedAt] = useState<string | null>(null)

  // Load selected portfolio metadata when portfolioId changes
  useEffect(() => {
    let isMounted = true
    setLoadingPortfolio(true)
    setPortfolioError(null)

    import("../services/api")
      .then(async ({ riskApi }) => {
        let targetId = portfolioId
        if (!targetId) {
          const ports = await riskApi.getPortfolios().catch(() => [])
          if (ports && ports.length > 0) targetId = ports[0].id
        }

        if (!targetId) {
          if (isMounted) {
            setPortfolioError("No active portfolio available")
            setLoadingPortfolio(false)
          }
          return
        }

        const p = await riskApi.getPortfolio(targetId).catch((err) => {
          if (isMounted) {
            setPortfolioError(err?.message || "Failed to load portfolio")
          }
          return null
        })

        if (isMounted) {
          if (p) setPortfolioMeta(p)
          setLoadingPortfolio(false)
        }
      })
      .catch((err) => {
        if (isMounted) {
          setPortfolioError(err?.message || "Failed to initialize API")
          setLoadingPortfolio(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [portfolioId])

  // Execute stress test run
  const runTest = useCallback(
    async (paramValues = values) => {
      if (loading) return // Prevent duplicate submission while running

      setLoading(true)
      setError(null)

      try {
        const { riskApi } = await import("../services/api")
        let targetId = portfolioId || portfolioMeta?.id

        if (!targetId) {
          const ports = await riskApi.getPortfolios().catch(() => [])
          if (ports && ports.length > 0) targetId = ports[0].id
        }

        if (!targetId) {
          throw new Error("Cannot run stress test: No portfolio selected")
        }

        const res = await riskApi.runStressTest(
          targetId,
          paramValues,
          undefined,
          triggerEvent?.id,
          true,
          triggerEvent ? 'event_driven' : 'manual'
        )

        if (!res || res.error) {
          throw new Error(res?.error?.message || "Invalid stress test response")
        }

        setBackendResult(res)
        setLastExecutedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
        )
      } catch (err: any) {
        console.error("[PortfolioStressTesting] API Error:", err)
        setError(err?.message || "Failed to execute stress test on backend.")
      } finally {
        setLoading(false)
      }
    },
    [portfolioId, portfolioMeta?.id, triggerEvent?.id, loading, values],
  )

  // Portfolio baseline & exposures derived from portfolioMeta or backendResult
  const baseline =
    backendResult?.baseline_value ??
    (portfolioMeta?.baseline_value
      ? Number(portfolioMeta.baseline_value)
      : portfolioMeta?.baselineValue
      ? Number(portfolioMeta.baselineValue)
      : 0)

  const loansExp =
    portfolioMeta?.loansExposure ??
    portfolioMeta?.exposures?.loans ??
    0
  const bondsExp =
    portfolioMeta?.bondsExposure ??
    portfolioMeta?.exposures?.bonds ??
    0
  const derivativesExp =
    portfolioMeta?.derivativesExposure ??
    portfolioMeta?.exposures?.derivatives ??
    0
  const equityExp =
    portfolioMeta?.equityExposure ??
    portfolioMeta?.exposures?.equity ??
    0

  const totalExposures = loansExp + bondsExp + derivativesExp + equityExp

  const loansPct = totalExposures > 0 ? (loansExp / totalExposures) * 100 : 0
  const bondsPct = totalExposures > 0 ? (bondsExp / totalExposures) * 100 : 0
  const derivativesPct =
    totalExposures > 0 ? (derivativesExp / totalExposures) * 100 : 0
  const equityPct = totalExposures > 0 ? (equityExp / totalExposures) * 100 : 0

  const hasExposures = totalExposures > 0
  const showReconciliationWarning =
    hasExposures && Math.abs(totalExposures - baseline) > 1.0

  // Result metrics
  const hasRun = backendResult !== null
  const loss = backendResult?.absolute_loss ?? 0
  const stressed = backendResult?.stressed_value ?? baseline

  const loansLoss = backendResult?.attribution_result?.loansLoss ?? 0
  const bondsLoss = backendResult?.attribution_result?.bondsLoss ?? 0
  const derivativesLoss = backendResult?.attribution_result?.derivativesLoss ?? 0
  const equityLoss = backendResult?.attribution_result?.equityLoss ?? 0

  const update = (key: keyof typeof values, value: number) =>
    setValues((current) => ({ ...current, [key]: value }))

  return (
    <div className="page">
      <PageHeading
        title="Portfolio Stress Testing"
        description="Estimate potential banking portfolio losses under changes in market, rate, commodity, and inflation variables."
      />

      {portfolioError && (
        <section className="stress-error-card" style={{ marginBottom: "16px" }}>
          <span>⚠️ Portfolio Data Error: {portfolioError}</span>
        </section>
      )}

      {showReconciliationWarning && (
        <section className="reconciliation-warning-banner">
          <span>
            ⚠️ <strong>Portfolio Reconciliation Notice:</strong> Constituent
            asset holdings sum to <b>₹{totalExposures.toFixed(1)} Cr</b>, which
            differs from the configured portfolio baseline (<b>₹{baseline.toFixed(1)} Cr</b>). Canonical portfolio baseline used for stress calculations.
          </span>
        </section>
      )}

      {triggerEvent && (
        <section className="stress-trigger-bridge">
          <span>
            <small>Risk Intelligence trigger</small>
            <b>{triggerEvent.title}</b>
          </span>
          <i>→</i>
          <span>
            <small>Mapped scenario</small>
            <b>{mappedScenarioForEvent(triggerEvent.category)}</b>
          </span>
          <Button variant="text" onClick={openScenario}>
            Open Scenario Analysis
          </Button>
        </section>
      )}

      <Summary
        items={[
          {
            label: "Portfolio exposure",
            value: baseline > 0 ? `₹${baseline.toFixed(1)} Cr` : "...",
            detail: portfolioMeta?.name || "Configured Portfolio",
          },
          {
            label: "Loans",
            value: hasExposures ? `₹${loansExp.toFixed(1)} Cr` : "...",
            detail: hasExposures ? `${loansPct.toFixed(1)}% of exposure` : "Constituent data unavailable",
          },
          {
            label: "Bonds",
            value: hasExposures ? `₹${bondsExp.toFixed(1)} Cr` : "...",
            detail: hasExposures ? `${bondsPct.toFixed(1)}% of exposure` : "Constituent data unavailable",
          },
          {
            label: "Derivatives",
            value: hasExposures ? `₹${derivativesExp.toFixed(1)} Cr` : "...",
            detail: hasExposures ? `${derivativesPct.toFixed(1)}% of exposure` : "Constituent data unavailable",
          },
        ]}
      />

      <div className="workspace-grid stress-layout">
        <div className="analysis-column">
          <RiskHistogram
            portfolio={portfolioMeta}
            isLoading={loadingPortfolio}
            isError={!!portfolioError}
            title="Credit Exposure Distribution by Default Risk"
            subtitle="Portfolio exposure categorized by modeled default risk probability buckets"
          />

          {error && (
            <div className="stress-error-card" style={{ margin: "16px 0" }}>
              <span>⚠️ Stress Calculation Error: {error}</span>
              <Button variant="text" onClick={() => runTest(values)} disabled={loading}>
                Retry Calculation
              </Button>
            </div>
          )}

          <div className="result-strip" style={{ position: "relative" }}>
            <span>
              <small>Baseline portfolio value</small>
              <strong>
                {loading ? "..." : baseline > 0 ? `₹${baseline.toFixed(1)} Cr` : "--"}
              </strong>
            </span>
            <span>
              <small>Stressed portfolio value</small>
              <strong>
                {loading ? "..." : hasRun ? `₹${stressed.toFixed(1)} Cr` : "--"}
              </strong>
            </span>
            <span>
              <small>Absolute change</small>
              <strong className={hasRun && loss > 0 ? "negative" : ""}>
                {loading
                  ? "..."
                  : !hasRun
                  ? "--"
                  : loss > 0
                  ? `-₹${loss.toFixed(1)} Cr`
                  : loss < 0
                  ? `+₹${Math.abs(loss).toFixed(1)} Cr`
                  : `₹0.0 Cr`}
              </strong>
            </span>
            <span>
              <small>Percentage change</small>
              <strong className={hasRun && loss > 0 ? "negative" : ""}>
                {loading
                  ? "..."
                  : !hasRun
                  ? "--"
                  : loss > 0
                  ? `-${((loss / (baseline || 1)) * 100).toFixed(2)}%`
                  : `0.00%`}
              </strong>
            </span>
          </div>

          {lastExecutedAt && !loading && hasRun && (
            <div className="stress-status-banner" style={{ fontSize: "11px", color: "var(--secondary)", marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              <span>
                Stress test executed successfully at {lastExecutedAt}
                {backendResult?.parameters_used?.parameter_source && (
                  <span style={{ marginLeft: "8px", padding: "2px 6px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.1)", fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Source: {backendResult.parameters_used.parameter_source.replace('_', ' ')}
                  </span>
                )}
              </span>
            </div>
          )}

          <section className="exposure-analysis" style={{ marginTop: "16px" }}>
            <PanelTitle
              title="Banking exposure analysis"
              subtitle="Estimated contribution to stressed loss / gain"
            />
            {!hasRun ? (
              <div className="empty-state" style={{ padding: "24px", textAlign: "center", color: "var(--secondary)" }}>
                <span>Run a stress test using the control panel to view asset-class loss contribution.</span>
              </div>
            ) : (
              <div className="stacked-exposure">
                {loansPct > 0 && (
                  <div style={{ width: `${loansPct.toFixed(1)}%` }}>
                    <span>Loans</span>
                    <b>
                      {loansLoss > 0
                        ? `₹${loansLoss.toFixed(1)} Cr`
                        : loansLoss < 0
                        ? `+₹${Math.abs(loansLoss).toFixed(1)} Cr`
                        : `₹0.0 Cr`}
                    </b>
                  </div>
                )}
                {bondsPct > 0 && (
                  <div style={{ width: `${bondsPct.toFixed(1)}%` }}>
                    <span>Bonds</span>
                    <b>
                      {bondsLoss > 0
                        ? `₹${bondsLoss.toFixed(1)} Cr`
                        : bondsLoss < 0
                        ? `+₹${Math.abs(bondsLoss).toFixed(1)} Cr`
                        : `₹0.0 Cr`}
                    </b>
                  </div>
                )}
                {derivativesPct > 0 && (
                  <div style={{ width: `${derivativesPct.toFixed(1)}%` }}>
                    <span>Derivatives</span>
                    <b>
                      {derivativesLoss > 0
                        ? `₹${derivativesLoss.toFixed(1)} Cr`
                        : derivativesLoss < 0
                        ? `+₹${Math.abs(derivativesLoss).toFixed(1)} Cr`
                        : `₹0.0 Cr`}
                    </b>
                  </div>
                )}
                {equityPct > 0 && (
                  <div style={{ width: `${equityPct.toFixed(1)}%` }}>
                    <span>Equity</span>
                    <b>
                      {equityLoss > 0
                        ? `₹${equityLoss.toFixed(1)} Cr`
                        : equityLoss < 0
                        ? `+₹${Math.abs(equityLoss).toFixed(1)} Cr`
                        : `₹0.0 Cr`}
                    </b>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="control-panel stress-controls">
          <PanelTitle
            title="Adjust stress parameters"
            subtitle="100% represents the baseline value"
          />
          <div className="control-stack compact">
            <div className="control-group-label">Market variables</div>
            <Slider
              label="S&P 500"
              value={values.sp}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("sp", value)}
            />
            <Slider
              label="Emerging Markets"
              value={values.emerging}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("emerging", value)}
            />
            <Slider
              label="Technology"
              value={values.technology}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("technology", value)}
            />
            <Slider
              label="Oil"
              value={values.oil}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("oil", value)}
            />
            <Slider
              label="Gold"
              value={values.gold}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("gold", value)}
            />
            <Slider
              label="US Dollar"
              value={values.dollar}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("dollar", value)}
            />
            <div className="control-group-label">Macroeconomic variables</div>
            <Slider
              label="Interest Rates"
              value={values.rates}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("rates", value)}
            />
            <Slider
              label="Inflation"
              value={values.inflation}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("inflation", value)}
            />
          </div>
          <div className="stress-actions">
            <Button
              variant="primary"
              loading={loading}
              disabled={loading || loadingPortfolio}
              onClick={() => runTest(values)}
            >
              {loading ? "Running stress test…" : "Run Stress Test"}
            </Button>
            <Button
              variant="outline"
              icon="reset"
              disabled={loading}
              onClick={() => {
                setValues(defaultValues)
              }}
            >
              Reset controls
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}

