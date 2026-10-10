import React, { useState, useEffect } from "react"
import {
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "../types"

import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
} from "../utils"
import { Icon } from "../components/common/Icon"
import { Button } from "../components/common/Button"
import { Slider } from "../components/common/Slider"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { AssetLossDialog } from "../components/stress-testing/AssetLossDialog"
import { WhyLossDialog } from "../components/stress-testing/WhyLossDialog"
import { EventStressComparisonDialog } from "../components/stress-testing/EventStressComparisonDialog"
import { ScenarioComparisonDialog } from "../components/scenario-analysis/ScenarioComparisonDialog"
import { RunDetailsDialog } from "../components/stress-testing/RunDetailsDialog"
import { LossGenerationExplainability } from "../components/scenario-analysis/LossGenerationExplainability"

const defaultScenarioData: Record<string, ScenarioControls> = {
  "Interest Rate Shock": { rate: 250, spread: 120, probability: 2, liquidity: 8, inflation: 150 },
  "Credit Crisis": { rate: -50, spread: 350, probability: 8, liquidity: 20, inflation: 50 },
  "Combined Macro Stress": { rate: 150, spread: 250, probability: 5, liquidity: 15, inflation: 200 }
}

export function Scenarios({
  portfolioId,
  stressRun,
  history = [],
  historyLoading = false,
  historyError = null,
  onRunCompleted = () => {},
  onRetryHistory = () => {},
}: {
  portfolioId: string | null
  stressRun: StressTestRun | null
  history?: StressTestHistoryEntry[]
  historyLoading?: boolean
  historyError?: string | null
  onRunCompleted?: (entry: StressTestHistoryEntry) => void
  onOpenHistory?: (entry: StressTestHistoryEntry) => void
  onRetryHistory?: () => void
}) {
  const [backendResult, setBackendResult] = useState<any>(null)
  const [portfolioMeta, setPortfolioMeta] = useState<any>(null)
  const [scenarioOptions, setScenarioOptions] = useState(defaultScenarioData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const triggerEvent = stressRun?.event ?? null
  const triggeredScenario = stressRun?.scenario ?? "Interest Rate Shock"
  const [scenario, setScenario] = useState<ScenarioName>(triggeredScenario)
  const [controls, setControls] = useState<ScenarioControls>(
    stressRun?.parameters ?? defaultScenarioData[triggeredScenario]
  )
  const [applied, setApplied] = useState<ScenarioControls>(controls)
  const [processingStep, setProcessingStep] = useState(
    stressRun?.skipProcessing ? 7 : stressRun ? 0 : 7
  )
  const [runComplete, setRunComplete] = useState(
    !stressRun || Boolean(stressRun.skipProcessing)
  )

  const [selectedAsset, setSelectedAsset] = useState<AssetName | null>(null)
  const [whyLossOpen, setWhyLossOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [eventComparisonOpen, setEventComparisonOpen] = useState(false)
  const [riskInfoOpen, setRiskInfoOpen] = useState(false)
  const [selectedRunDetails, setSelectedRunDetails] = useState<StressTestHistoryEntry | null>(null)

  useEffect(() => {
    let cancelled = false
    import("../services/api").then(({ riskApi }) => {
      riskApi.getScenarios().then(scenarios => {
        if (cancelled) return
        if (scenarios.length === 0) {
          throw new Error("No scenario configurations are available.")
        }
        const persistedOptions = Object.fromEntries(scenarios.map(item => [
          item.name,
          {
            rate: item.rate,
            spread: item.spread,
            probability: item.probability,
            liquidity: item.liquidity,
            inflation: item.inflation
          }
        ])) as Record<string, ScenarioControls>
        setScenarioOptions(persistedOptions)
        if (!stressRun) {
          const selectedName = persistedOptions[scenario] ? scenario : scenarios[0].name
          const selectedParameters = persistedOptions[selectedName]
          setScenario(selectedName as ScenarioName)
          setControls(selectedParameters)
          setApplied(selectedParameters)
        }
      }).catch((error: Error) => {
        if (!cancelled) setError(`Failed to load saved scenarios: ${error.message}`)
      })
    }).catch((error: Error) => {
      if (!cancelled) setError(`Failed to load saved scenarios: ${error.message}`)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const runScenarioStressTest = async (
    paramControls = controls,
    scenarioName = scenario,
    shouldPersist: boolean = true,
    customRunType?: string
  ) => {
    setLoading(true)
    setError(null)
    try {
      const { riskApi } = await import("../services/api")
      let targetId = portfolioId
      if (!targetId) {
        const ports = await riskApi.getPortfolios().catch(() => [])
        if (ports && ports.length > 0) targetId = ports[0].id
      }
      if (!targetId) {
        setLoading(false)
        return
      }

      const pMeta = await riskApi.getPortfolio(targetId).catch(() => null)
      if (pMeta) setPortfolioMeta(pMeta)

      const res = await riskApi.runStressTest(
        targetId,
        paramControls,
        (stressRun as any)?.scenarioId,
        triggerEvent?.id,
        shouldPersist,
        customRunType || (triggerEvent ? 'event_driven' : 'manual')
      )

      setBackendResult(res)
      setApplied(paramControls)

      if (shouldPersist && stressRun && onRunCompleted && res && res.runId) {
        onRunCompleted({
          ...stressRun,
          runId: res.runId,
          id: res.id,
          scenario: scenarioName,
          displayTitle: res.displayTitle || scenarioName,
          parameters: paramControls,
          loss: res.absolute_loss,
          completedAt: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        })
      }
    } catch (err: any) {
      console.error("[Scenarios] API Stress Test Error:", err)
      setError(err?.message || "Failed to calculate scenario stress test.")
    } finally {
      setLoading(false)
      setRunComplete(true)
    }
  }

  useEffect(() => {
    if (!stressRun) {
      // Non-persisted preview calculation on page load - does NOT save to DB
      runScenarioStressTest(controls, scenario, false, 'default')
      return
    }

    setScenario(stressRun.scenario)
    setControls(stressRun.parameters)
    setApplied(stressRun.parameters)

    if (stressRun.skipProcessing) {
      setProcessingStep(7)
      setRunComplete(true)
      runScenarioStressTest(stressRun.parameters, stressRun.scenario, true, 'event_driven')
      return
    }

    setProcessingStep(0)
    setRunComplete(false)
    const timers = [180, 360, 540, 720, 900, 1080, 1260].map((delay, index) =>
      window.setTimeout(() => {
        setProcessingStep(index + 1)
      }, delay)
    )

    const completionTimer = window.setTimeout(() => {
      runScenarioStressTest(stressRun.parameters, stressRun.scenario, true, 'event_driven')
    }, 1400)

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      window.clearTimeout(completionTimer)
    }
  }, [stressRun, portfolioId])

  const changeScenario = (name: ScenarioName) => {
    setScenario(name)
    const newParams = scenarioOptions[name] || scenarioOptions[Object.keys(scenarioOptions)[0]]
    if (!newParams) {
      setError("No saved scenario configurations are available.")
      return
    }
    setControls(newParams)
    runScenarioStressTest(newParams, name)
  }

  const set = (key: keyof typeof controls, value: number) => {
    setControls((current) => ({ ...current, [key]: value }))
  }

  const baseline =
    backendResult?.baseline_value ??
    (portfolioMeta?.baseline_value
      ? Number(portfolioMeta.baseline_value)
      : 2450)
  const loss = backendResult?.absolute_loss ?? 0
  const riskScore = backendResult?.risk_score ?? Math.min(100, Math.round((loss / baseline) * 100))

  const severity =
    riskScore < 20
      ? "Low"
      : riskScore < 40
      ? "Moderate"
      : riskScore < 65
      ? "High"
      : "Severe"

  const loansExp = portfolioMeta?.exposures?.loans ?? (baseline * 0.30)
  const bondsExp = portfolioMeta?.exposures?.bonds ?? (baseline * 0.17)
  const derivativesExp = portfolioMeta?.exposures?.derivatives ?? (baseline * 0.10)
  const equityExp = portfolioMeta?.exposures?.equity ?? (baseline * 0.43)
  const totalExposures = loansExp + bondsExp + derivativesExp + equityExp
  const showReconciliationWarning = Math.abs(totalExposures - baseline) > 1.0

  // Dynamic asset-class loss attribution derived directly from backend results
  const loansLoss = backendResult?.attribution_result?.loansLoss ?? 0
  const bondsLoss = backendResult?.attribution_result?.bondsLoss ?? 0
  const derivativesLoss = backendResult?.attribution_result?.derivativesLoss ?? 0
  const equityLoss = backendResult?.attribution_result?.equityLoss ?? 0

  const grossLossSum = Math.max(0, loansLoss) + Math.max(0, bondsLoss) + Math.max(0, derivativesLoss) + Math.max(0, equityLoss)

  const assetRows = [
    {
      name: "Loans" as AssetName,
      exposure: `₹${loansExp.toFixed(1)} Cr`,
      lossVal: loansLoss,
      share: loansLoss > 0 && grossLossSum > 0 ? parseFloat(((loansLoss / grossLossSum) * 100).toFixed(1)) : 0,
      driver: "Credit spread & default probability",
    },
    {
      name: "Bonds" as AssetName,
      exposure: `₹${bondsExp.toFixed(1)} Cr`,
      lossVal: bondsLoss,
      share: bondsLoss > 0 && grossLossSum > 0 ? parseFloat(((bondsLoss / grossLossSum) * 100).toFixed(1)) : 0,
      driver: "Interest-rate & yield curve shift",
    },
    {
      name: "Derivatives" as AssetName,
      exposure: `₹${derivativesExp.toFixed(1)} Cr`,
      lossVal: derivativesLoss,
      share: derivativesLoss > 0 && grossLossSum > 0 ? parseFloat(((derivativesLoss / grossLossSum) * 100).toFixed(1)) : 0,
      driver: "Liquidity haircut & rate shift",
    },
    {
      name: "Equity" as AssetName,
      exposure: `₹${equityExp.toFixed(1)} Cr`,
      lossVal: equityLoss,
      share: equityLoss > 0 && grossLossSum > 0 ? parseFloat(((equityLoss / grossLossSum) * 100).toFixed(1)) : 0,
      driver: "Inflation, rate & liquidity sensitivity",
    },
  ]

  const rateFactorLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "interest_rate")?.loss ?? (applied.rate ? (applied.rate / 10000) * baseline * 0.2 : 0)
  const spreadFactorLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "spread")?.loss ?? (applied.spread ? (applied.spread / 10000) * baseline * 0.15 : 0)
  const pdFactorLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "default_probability")?.loss ?? (applied.probability ? (applied.probability / 100) * loansExp * 0.4 : 0)
  const liquidityFactorLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "liquidity")?.loss ?? (applied.liquidity ? (applied.liquidity / 100) * baseline * 0.05 : 0)
  const inflationFactorLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "inflation")?.loss ?? (applied.inflation ? (applied.inflation / 10000) * baseline * 0.12 : 0)
  const marketEquityLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "market_equity")?.loss ?? 0
  const commoditiesFxLoss = backendResult?.attribution_result?.factors?.find((f: any) => f.factor === "commodities_fx")?.loss ?? 0

  const rawFactors: [string, number][] = [
    ["Interest rate shock", rateFactorLoss],
    ["Credit spread shock", spreadFactorLoss],
    ["Default probability shift", pdFactorLoss],
    ["Liquidity haircut", liquidityFactorLoss],
    ["Inflation shock", inflationFactorLoss],
  ]

  if (marketEquityLoss > 0) rawFactors.push(["Market equity stress", marketEquityLoss])
  if (commoditiesFxLoss > 0) rawFactors.push(["Commodity / FX stress", commoditiesFxLoss])

  const factorTotal = rawFactors.reduce((sum, [, value]) => sum + value, 0)
  const residualVal = backendResult?.attribution_result?.interaction_residual ?? Math.max(0, parseFloat((loss - factorTotal).toFixed(2)))

  const factorRows: [string, number][] = [
    ...rawFactors.filter(([, val]) => val > 0),
    ["Interaction / residual", residualVal],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))

  const maxFactor = Math.max(
    ...factorRows.map(([, value]) => Math.abs(value)),
    1
  )

  const pctImpact = baseline > 0 ? (loss / baseline) * 100 : 0

  return (
    <div className="page scenario-page">
      <PageHeading
        title="Scenario Analysis"
        description="Compare baseline and stressed portfolio outcomes, then identify the asset classes driving potential losses."
      />

      {showReconciliationWarning && (
        <section className="reconciliation-warning-banner">
          <span>
            ⚠️ <strong>Portfolio Reconciliation Notice:</strong> Constituent asset holdings sum to <b>₹{totalExposures.toFixed(1)} Cr</b>, which differs from the configured portfolio baseline (<b>₹{baseline.toFixed(1)} Cr</b>). Canonical portfolio baseline used for calculations.
          </span>
        </section>
      )}

      {!runComplete && stressRun && (
        <section className="stress-processing-card">
          <div className="stress-processing-head">
            <span>Stress-test execution</span>
            <b>Generating event-specific stress test...</b>
          </div>
          <div className="stress-processing-steps">
            {[
              "Event analyzed",
              "Scenario generated",
              "Stress parameters generated",
              "Portfolio loaded",
              "Stress applied",
              "Portfolio impact calculated",
              "Loss attribution calculated",
            ].map((step, index) => (
              <span
                className={
                  index < processingStep
                    ? "complete"
                    : index === processingStep
                    ? "active"
                    : ""
                }
                key={step}
              >
                <i>
                  <Icon
                    name={index < processingStep ? "scenario" : "arrow"}
                    size={13}
                  />
                </i>
                <b>{step}</b>
              </span>
            ))}
          </div>
          <div className="stress-processing-context">
            <span>
              <small>Event classification</small>
              <b>{triggerEvent ? titleCase(triggerEvent.category) : "General Macro"}</b>
            </span>
            <span>
              <small>Generated scenario</small>
              <b>{stressRun.scenario}</b>
            </span>
            <span>
              <small>Portfolio</small>
              <b>{portfolioMeta?.name || "Banking Portfolio"}</b>
            </span>
          </div>
        </section>
      )}

      {runComplete && (
        <div className="workspace-grid">
          <div className="analysis-column">
            {error && (
              <div className="stress-error-card">
                <span>⚠️ Scenario Execution Error: {error}</span>
                <Button
                  variant="text"
                  onClick={() => runScenarioStressTest(controls, scenario)}
                >
                  Retry Scenario Calculation
                </Button>
              </div>
            )}

            <section className="scenario-comparison">
              <PanelTitle
                title="Portfolio comparison"
                subtitle={`${scenario} · hypothetical 12-month impact`}
                side={
                  <div className="scenario-panel-actions">
                    <span
                      className={`severity-badge severity-${severity.toLowerCase()}`}
                    >
                      {severity}
                    </span>
                    <Button
                      variant="text"
                      onClick={() => setComparisonOpen(true)}
                    >
                      Compare scenarios
                    </Button>
                  </div>
                }
              />
              <div className="comparison-values">
                <div>
                  <span>Before stress</span>
                  <strong>
                    {loading ? "..." : `₹${baseline.toFixed(1)} Cr`}
                  </strong>
                  <small className="risk-score-line">
                    Risk score {loading ? "..." : riskScore} / 100
                    <span className="risk-info-wrap">
                      <Button
                        variant="icon"
                        icon="info"
                        ariaLabel="Explain risk score"
                        onClick={() => setRiskInfoOpen(!riskInfoOpen)}
                      >
                        Risk score information
                      </Button>
                      {riskInfoOpen && (
                        <span className="risk-info-popover">
                          <b>Composite scenario severity indicator</b>
                          Risk score represents the severity of the modeled
                          scenario impact on the portfolio. Higher scores
                          indicate greater modeled stress.
                        </span>
                      )}
                    </span>
                  </small>
                </div>
                <Icon name="arrow" size={24} />
                <div>
                  <span>After stress</span>
                  <strong>
                    {loading ? "..." : `₹${(baseline - loss).toFixed(1)} Cr`}
                  </strong>
                  <small className="negative">
                    {loading
                      ? "..."
                      : `-₹${loss.toFixed(1)} Cr · -${pctImpact.toFixed(1)}%`}
                  </small>
                </div>
              </div>
              <div className="comparison-bars">
                <div>
                  <span>Baseline</span>
                  <i style={{ width: "100%" }} />
                </div>
                <div>
                  <span>Stressed</span>
                  <i
                    style={{
                      width: `${
                        baseline > 0
                          ? Math.max(0, ((baseline - loss) / baseline) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div className="total-loss-reconciliation">
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setWhyLossOpen(true)}
                  onKeyDown={(input) => {
                    if (input.key === "Enter" || input.key === " ")
                      setWhyLossOpen(true)
                  }}
                >
                  <small>Total modeled loss</small>
                  <b className="negative">
                    {loading ? "..." : `₹${loss.toFixed(1)} Cr`}
                  </b>
                  <i>Explained by asset-class contributions</i>
                </span>
                <Button variant="text" onClick={() => setWhyLossOpen(true)}>
                  Why did we lose?
                </Button>
              </div>
            </section>

            <section className="waterfall-panel">
              <PanelTitle
                title="Loss attribution"
                subtitle="Contribution to total modeled loss"
              />
              <div className="waterfall-chart">
                {assetRows.map((asset) => (
                  <div
                    key={asset.name}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedAsset(asset.name)}
                    onKeyDown={(input) => {
                      if (input.key === "Enter" || input.key === " ")
                        setSelectedAsset(asset.name)
                    }}
                  >
                    <span
                      style={{
                        height: `${Math.max(12, asset.share)}%`,
                      }}
                    >
                      <i>₹{asset.lossVal.toFixed(1)} Cr</i>
                    </span>
                    <small>{asset.name}</small>
                  </div>
                ))}
              </div>
              <div className="loss-reconciliation-note">
                <b>₹{loss.toFixed(1)} Cr total modeled loss</b>
                <span>
                  Asset-class contributions reconcile to 100%. Values match canonical backend risk engine.
                </span>
              </div>
            </section>

            <section className="risk-factor-panel">
              <PanelTitle
                title="Risk factor contribution"
                subtitle="How the scenario assumptions contribute to modeled portfolio loss"
              />
              <div className="risk-factor-list">
                {factorRows.map(([label, value]) => (
                  <div key={label}>
                    <span>
                      <b>{label}</b>
                      <strong className={value < 0 ? "positive" : "negative"}>
                        {value < 0 ? "−" : ""}₹{Math.abs(value).toFixed(1)} Cr
                        <small>
                          {loss > 0
                            ? Math.abs((value / loss) * 100).toFixed(0)
                            : 0}
                          % of explained loss
                        </small>
                      </strong>
                    </span>
                    <i>
                      <b
                        className={value < 0 ? "offset" : ""}
                        style={{
                          width: `${Math.max(
                            2,
                            (Math.abs(value) / maxFactor) * 100
                          )}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
              <span className="factor-method-note">
                Contributions use factor sensitivities from backend RiskEngineService.
              </span>
            </section>

            <LossGenerationExplainability
              backendResult={backendResult}
              scenarioName={scenario}
              runType={stressRun ? (stressRun as any).run_type || "event_driven" : "manual"}
              controls={applied}
              portfolioMeta={portfolioMeta}
            />

            <section className="asset-contribution">
              <PanelTitle
                title="Asset class contribution"
                subtitle="Exposure, loss and relative contribution"
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset class</th>
                      <th>Exposure</th>
                      <th>Modeled loss / gain</th>
                      <th>Gross loss contribution</th>
                      <th>Primary driver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetRows.map((asset) => (
                      <tr
                        key={asset.name}
                        onClick={() => setSelectedAsset(asset.name)}
                      >
                        <td>
                          <strong>{asset.name}</strong>
                        </td>
                        <td>{asset.exposure}</td>
                        <td className={asset.lossVal > 0 ? "negative" : asset.lossVal < 0 ? "positive" : ""}>
                          {asset.lossVal > 0
                            ? `₹${asset.lossVal.toFixed(1)} Cr`
                            : asset.lossVal < 0
                            ? `+₹${Math.abs(asset.lossVal).toFixed(1)} Cr (gain)`
                            : `₹0.0 Cr`}
                        </td>
                        <td>{asset.lossVal > 0 ? `${asset.share.toFixed(1)}%` : asset.lossVal < 0 ? `Gain (offset)` : `0.0%`}</td>
                        <td>
                          <span className="driver-link">{asset.driver}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="risk-metrics-panel">
              <PanelTitle
                title="Risk metrics"
                subtitle="Current modeled scenario impact"
              />
              <div className="risk-metrics-grid">
                <span>
                  <small>Stress loss</small>
                  <b className={loss > 0 ? "negative" : ""}>
                    {loss > 0 ? `-₹${loss.toFixed(1)} Cr` : "₹0.0 Cr"}
                  </b>
                </span>
                <span>
                  <small>Portfolio impact</small>
                  <b className={loss > 0 ? "negative" : ""}>
                    {loss > 0 ? `-${pctImpact.toFixed(1)}%` : "0.0%"}
                  </b>
                </span>
                <span className="metric-info">
                  <small>
                    95% VaR <Icon name="info" size={12} />
                  </small>
                  <b>Not calculated</b>
                  <i>
                    Estimated loss threshold at the selected confidence level.
                  </i>
                </span>
                <span className="metric-info">
                  <small>
                    95% Expected Shortfall <Icon name="info" size={12} />
                  </small>
                  <b>Not calculated</b>
                  <i>Average modeled loss beyond the VaR threshold.</i>
                </span>
              </div>
            </section>
          </div>

          <aside className="control-panel">
            <PanelTitle
              title="Scenario parameters"
              subtitle="Configure a hypothetical stress"
            />
            <div className="control-stack">
              <div className="control-group-label">Scenario selection</div>
              <label className="field-label">
                <span>Scenario</span>
                <select
                  value={scenario}
                  onChange={(event) =>
                    changeScenario(event.target.value as ScenarioName)
                  }
                >
                  {Object.keys(scenarioOptions).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <div className="control-group-label">
                Market and credit shocks
              </div>
              <Slider
                label="Interest rate shock"
                value={controls.rate}
                min={-300}
                max={500}
                suffix=" bps"
                onChange={(value) => set("rate", value)}
              />
              <Slider
                label="Credit spread shock"
                value={controls.spread}
                min={0}
                max={600}
                suffix=" bps"
                onChange={(value) => set("spread", value)}
              />
              <Slider
                label="Default probability adjustment"
                value={controls.probability}
                min={0}
                max={15}
                suffix="%"
                onChange={(value) => set("probability", value)}
              />
              <Slider
                label="Liquidity haircut"
                value={controls.liquidity}
                min={0}
                max={30}
                suffix="%"
                onChange={(value) => set("liquidity", value)}
              />
              <Slider
                label="Inflation shock"
                value={controls.inflation}
                min={-200}
                max={500}
                suffix=" bps"
                onChange={(value) => set("inflation", value)}
              />
            </div>
            <Button
              disabled={loading}
              onClick={() => runScenarioStressTest(controls, scenario, true, 'manual')}
            >
              {loading ? "Calculating..." : "Run Manual Stress Test"}
            </Button>
          </aside>
        </div>
      )}

      <section className="stress-history-panel">
        <PanelTitle
          title="Stress Test History"
          subtitle="Audit log of persisted manual, preset, and event-driven stress test executions"
          side={
            history.length ? (
              <Button
                variant="text"
                onClick={() => setEventComparisonOpen(true)}
              >
                Compare Stress Tests
              </Button>
            ) : undefined
          }
        />
        {historyLoading ? (
          <div className="empty-state">
            <strong>Loading stress test history...</strong>
            <span>Fetching historical runs from database</span>
          </div>
        ) : historyError ? (
          <div className="stress-error-card">
            <span>⚠️ {historyError}</span>
            <Button variant="text" onClick={onRetryHistory}>
              Retry Loading History
            </Button>
          </div>
        ) : history.length ? (
          <div className="table-wrap">
            <table className="stress-history-table">
              <thead>
                <tr>
                  <th>Run Identity</th>
                  <th className="col-portfolio">Portfolio</th>
                  <th className="col-time">Executed At</th>
                  <th>Source</th>
                  <th className="text-right">Portfolio loss</th>
                  <th className="text-right">Loss %</th>
                  <th className="text-center col-status">Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => {
                  const entryLoss = typeof entry.loss === "number" ? entry.loss : Number((entry as any).absoluteLoss || 0)
                  const label = entry.displayTitle || entry.scenario || "Legacy Run · Origin Unknown"
                  const entryBaseline = entry.baselineValue || baseline || 1000
                  const lossPct = entryBaseline > 0 ? (entryLoss / entryBaseline) * 100 : 0
                  const pName = entry.portfolio_name || "Primary Portfolio"
                  const sourceLabel = entry.parameterSource || entry.run_type || "unknown"

                  return (
                    <tr key={String(entry.runId || entry.id)}>
                      <td>
                        <div className="history-run-title">{label}</div>
                        <span className="history-run-sub-mobile">{pName} · {entry.completedAt || "Recently"}</span>
                      </td>
                      <td className="col-portfolio">{pName}</td>
                      <td className="col-time">{entry.completedAt || "Recently"}</td>
                      <td>
                        <span className="history-source-badge">
                          {sourceLabel}
                        </span>
                      </td>
                      <td className={`text-right ${entryLoss > 0 ? "negative" : ""}`}>
                        <strong>{entryLoss > 0 ? `-₹${entryLoss.toFixed(1)} Cr` : `₹0.0 Cr`}</strong>
                      </td>
                      <td className={`text-right ${entryLoss > 0 ? "negative" : ""}`}>
                        {entryLoss > 0 ? `-${lossPct.toFixed(1)}%` : `0.0%`}
                      </td>
                      <td className="text-center col-status">
                        <span className="history-status">
                          <i /> Completed
                        </span>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline"
                          className="history-details-btn"
                          onClick={() => setSelectedRunDetails(entry)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>No completed stress tests found</strong>
            <span>
              Run a manual calculation, preset scenario, or event stress test to create persistent history.
            </span>
          </div>
        )}
      </section>

      {selectedRunDetails && (
        <RunDetailsDialog
          run={selectedRunDetails}
          onClose={() => setSelectedRunDetails(null)}
        />
      )}

      {selectedAsset && (
        <AssetLossDialog
          asset={selectedAsset}
          loss={loss}
          onClose={() => setSelectedAsset(null)}
        />
      )}
      {whyLossOpen && (
        <WhyLossDialog
          loss={loss}
          baseline={baseline}
          scenario={scenario}
          attribution={backendResult?.attribution_result}
          onClose={() => setWhyLossOpen(false)}
        />
      )}
      {comparisonOpen && (
        <ScenarioComparisonDialog
          portfolioId={portfolioId}
          baseline={baseline}
          onClose={() => setComparisonOpen(false)}
        />
      )}
      {eventComparisonOpen && history.length > 0 && (
        <EventStressComparisonDialog
          history={history}
          onClose={() => setEventComparisonOpen(false)}
        />
      )}
    </div>
  )
}
