import React, { useState, useEffect, useMemo } from "react"
import {
  Page,
  IconName,
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
  generateEventStressParameters,
  calculateScenarioLoss,
} from "../utils"
import { Icon } from "../components/common/Icon"
import { VantageLogo } from "../components/common/VantageLogo"
import { Button } from "../components/common/Button"
import { Slider } from "../components/common/Slider"
import { Summary } from "../components/common/Summary"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { SettingsPanel } from "../components/common/SettingsPanel"
import { RiskHistogram } from "../components/risk-intelligence/RiskHistogram"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"
import { MiniDistribution } from "../components/risk-intelligence/MiniDistribution"
import { AllocationChart } from "../components/allocation/AllocationChart"
import { AllocationHistory } from "../components/allocation/AllocationHistory"
import { AllocationExplanationDialog } from "../components/allocation/AllocationExplanationDialog"
import { OverallAllocationDialog } from "../components/allocation/OverallAllocationDialog"
import { AssetLossDialog } from "../components/stress-testing/AssetLossDialog"
import { WhyLossDialog } from "../components/stress-testing/WhyLossDialog"
import { EventStressComparisonDialog } from "../components/stress-testing/EventStressComparisonDialog"
import { ScenarioComparisonDialog } from "../components/scenario-analysis/ScenarioComparisonDialog"

const defaultScenarioData: Record<string, ScenarioControls> = {
  "Interest Rate Shock": { rate: 250, spread: 120, probability: 2, liquidity: 8, inflation: 150 },
  "Credit Crisis": { rate: -50, spread: 350, probability: 8, liquidity: 20, inflation: 50 },
  "Combined Macro Stress": { rate: 150, spread: 250, probability: 5, liquidity: 15, inflation: 200 }
};

export function Scenarios({
  portfolioId,
  stressRun,
  history = [],
  onRunCompleted = () => {},
  onOpenHistory = () => {},
}: {
  portfolioId: string | null
  stressRun: StressTestRun | null
  history?: StressTestHistoryEntry[]
  onRunCompleted?: (entry: StressTestHistoryEntry) => void
  onOpenHistory?: (entry: StressTestHistoryEntry) => void
}) {
  const [backendResult, setBackendResult] = useState<any>(null)
  const triggerEvent = stressRun?.event ?? null
  const triggeredScenario = stressRun?.scenario ?? "Interest Rate Shock"
  const [scenario, setScenario] = useState<ScenarioName>(triggeredScenario)
  const [controls, setControls] = useState(
    stressRun?.parameters ?? defaultScenarioData[triggeredScenario],
  )
  const [applied, setApplied] = useState(controls)
  const [processingStep, setProcessingStep] = useState(
    stressRun?.skipProcessing ? 7 : stressRun ? 0 : 7,
  )
  const [runComplete, setRunComplete] = useState(
    !stressRun || Boolean(stressRun.skipProcessing),
  )
  const [selectedAsset, setSelectedAsset] = useState<AssetName | null>(null)
  const [whyLossOpen, setWhyLossOpen] = useState(false)
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [eventComparisonOpen, setEventComparisonOpen] = useState(false)
  const [riskInfoOpen, setRiskInfoOpen] = useState(false)
  useEffect(() => {
    if (!stressRun) return
    setScenario(stressRun.scenario)
    setControls(stressRun.parameters)
    setApplied(stressRun.parameters)
    if (stressRun.skipProcessing) {
      setProcessingStep(7)
      setRunComplete(true)
      return
    }
    setProcessingStep(0)
    setRunComplete(false)
    const timers = [180, 360, 540, 720, 900, 1080, 1260].map((delay, index) =>
      window.setTimeout(() => {
        setProcessingStep(index + 1)
      }, delay),
    )
    const completionTimer = window.setTimeout(() => {
      if (portfolioId) {
        import("../services/api").then(({ riskApi }) => {
          riskApi.runStressTest(portfolioId, stressRun.parameters, (stressRun as any).scenarioId, triggerEvent?.id)
            .then(res => {
              setBackendResult(res)
              onRunCompleted({
                ...stressRun,
                loss: res.absolute_loss,
                completedAt: new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })
              setRunComplete(true)
            })
            .catch(err => {
              console.error(err)
              setRunComplete(true)
            })
        })
      } else {
        setRunComplete(true)
      }
    }, 1500)
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
      window.clearTimeout(completionTimer)
    }
  }, [stressRun, portfolioId])
  const changeScenario = (name: ScenarioName) => {
    setScenario(name)
    setControls(defaultScenarioData[name])
  }
  const set = (key: keyof typeof controls, value: number) => {
    setControls((current) => ({ ...current, [key]: value }))
  }
  const loss = backendResult ? backendResult.absolute_loss : calculateScenarioLoss(applied)
  const baseline = backendResult?.baseline_value ?? 2450
  const riskScore = backendResult ? backendResult.risk_score : Math.min(100, Math.round(loss * 0.75))
  const severity =
    riskScore < 20
      ? "Low"
      : riskScore < 40
        ? "Moderate"
        : riskScore < 65
          ? "High"
          : "Severe"
  const assetRows: {
    name: AssetName
    exposure: string
    share: number
    driver: string
  }[] = [
    {
      name: "Loans",
      exposure: "₹1,360 Cr",
      share: 47,
      driver: "Default probability",
    },
    {
      name: "Bonds",
      exposure: "₹800 Cr",
      share: 31,
      driver: "Rate and spread duration",
    },
    {
      name: "Derivatives",
      exposure: "₹290 Cr",
      share: 12,
      driver: "Counterparty exposure",
    },
    {
      name: "Liquidity",
      exposure: "Portfolio-wide",
      share: 10,
      driver: "Liquidity haircut",
    },
  ]
  const rawFactors = backendResult?.attribution_result ? [
    ["Interest rate shock", backendResult.attribution_result.factors?.find((f: any) => f.factor === 'interest_rate')?.loss || 0],
    ["Default probability", backendResult.attribution_result.factors?.find((f: any) => f.factor === 'probability')?.loss || 0],
    ["Credit spread shock", backendResult.attribution_result.factors?.find((f: any) => f.factor === 'spread')?.loss || 0],
    ["Liquidity haircut", backendResult.attribution_result.factors?.find((f: any) => f.factor === 'liquidity')?.loss || 0],
    ["Inflation shock", backendResult.attribution_result.factors?.find((f: any) => f.factor === 'inflation')?.loss || 0]
  ] as [string, number][] : [
    ["Interest rate shock", applied.rate * 0.07],
    ["Default probability", applied.probability * 5.8],
    ["Credit spread shock", applied.spread * 0.09],
    ["Liquidity haircut", applied.liquidity * 1.5],
    ["Inflation shock", applied.inflation * 0.025],
  ] as [string, number][]
  const factorTotal = rawFactors.reduce((sum, [, value]) => sum + value, 0)
  const factorRows: [string, number][] = backendResult?.attribution_result ? [
    ...rawFactors,
    ["Interaction / residual", backendResult.attribution_result.interaction_residual || 0]
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) : [
    ...rawFactors,
    ["Interaction / residual", loss - factorTotal],
  ].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const maxFactor = Math.max(
    ...factorRows.map(([, value]) => Math.abs(value)),
    1,
  )
  return (
    <div className="page scenario-page">
      <PageHeading
        title="Scenario Analysis"
        description="Compare baseline and stressed portfolio outcomes, then identify the asset classes driving potential losses."
      />
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
              <b>{titleCase(triggerEvent.category)}</b>
            </span>
            <span>
              <small>Generated scenario</small>
              <b>{stressRun.scenario}</b>
            </span>
            <span>
              <small>Portfolio</small>
              <b>Banking Demo Portfolio</b>
            </span>
          </div>
        </section>
      )}
      {runComplete && (
        <div className="workspace-grid">
          <div className="analysis-column">
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
                  <strong>₹2,450.0 Cr</strong>
                  <small className="risk-score-line">
                    Risk score {riskScore} / 100
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
                  <strong>₹{(baseline - loss).toFixed(1)} Cr</strong>
                  <small className="negative">
                    -₹{loss.toFixed(1)} Cr · -{(loss / 24.5).toFixed(1)}%
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
                  <i style={{ width: `${(baseline - loss) / 24.5}%` }} />
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
                  <b className="negative">₹{loss.toFixed(1)} Cr</b>
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
                        height: `${Math.max(14, asset.share)}%`,
                      }}
                    >
                      <i>₹{((loss * asset.share) / 100).toFixed(1)} Cr</i>
                    </span>
                    <small>{asset.name}</small>
                  </div>
                ))}
              </div>
              <div className="loss-reconciliation-note">
                <b>₹{loss.toFixed(1)} Cr total modeled loss</b>
                <span>
                  Asset-class contributions reconcile to 100%. Values may not
                  sum exactly due to rounding.
                </span>
              </div>
            </section>
            <section className="risk-factor-panel">
              <PanelTitle
                title="Risk factor contribution"
                subtitle="How the scenario assumptions contribute to modeled portfolio loss"
                side={
                  <span className="prototype-label">Prototype attribution</span>
                }
              />
              <div className="risk-factor-list">
                {factorRows.map(([label, value]) => (
                  <div key={label}>
                    <span>
                      <b>{label}</b>
                      <strong className={value < 0 ? "positive" : "negative"}>
                        {value < 0 ? "−" : ""}₹{Math.abs(value).toFixed(1)} Cr
                        <small>
                          {Math.abs((value / loss) * 100).toFixed(0)}% of
                          explained loss
                        </small>
                      </strong>
                    </span>
                    <i>
                      <b
                        className={value < 0 ? "offset" : ""}
                        style={{
                          width: `${Math.max(2, (Math.abs(value) / maxFactor) * 100)}%`,
                        }}
                      />
                    </i>
                  </div>
                ))}
              </div>
              <span className="factor-method-note">
                Contributions use the prototype's existing factor sensitivities
                and reconcile to the total modeled loss.
              </span>
            </section>
            <section className="loss-generation-panel">
              <PanelTitle
                title="How the loss was generated"
                subtitle="Scenario shock → risk factor → asset-class impact"
              />
              <div className="loss-generation-grid">
                {[
                  [
                    `${signedValue(applied.rate, 0)} bps interest rate shock`,
                    "Bond valuation impact",
                    `₹${(loss * 0.31).toFixed(1)} Cr bond loss`,
                  ],
                  [
                    `${signedValue(applied.probability, 0)}% default probability`,
                    "Higher expected loan losses",
                    `₹${(loss * 0.47).toFixed(1)} Cr loan loss`,
                  ],
                  [
                    `${signedValue(applied.spread, 0)} bps credit spread shock`,
                    "Credit-sensitive asset repricing",
                    "Included in bond and credit loss",
                  ],
                  [
                    `${applied.liquidity}% liquidity haircut`,
                    "Liquidity adjustment",
                    `₹${(loss * 0.1).toFixed(1)} Cr liquidity loss`,
                  ],
                ].map(([shock, effect, result]) => (
                  <div key={shock}>
                    <span>{shock}</span>
                    <i>↓</i>
                    <span>{effect}</span>
                    <i>↓</i>
                    <strong>{result}</strong>
                  </div>
                ))}
              </div>
            </section>
            {triggerEvent && (
              <section className="event-loss-cause-panel">
                <PanelTitle
                  title="Why did this event cause the loss?"
                  subtitle="Event → classification → risk factors → asset impact → portfolio impact"
                />
                <div className="event-loss-cause-flow">
                  <span>
                    <small>Event</small>
                    <b>{triggerEvent.title}</b>
                  </span>
                  <i>→</i>
                  <span>
                    <small>Classification</small>
                    <b>{titleCase(triggerEvent.category)}</b>
                  </span>
                  <i>→</i>
                  <span>
                    <small>Risk factors</small>
                    <b>Rates · Spreads · Default · Liquidity</b>
                  </span>
                  <i>→</i>
                  <span className="event-loss-assets">
                    <small>Asset impact</small>
                    {(["Loans", "Bonds", "Derivatives"] as AssetName[]).map(
                      (asset) => (
                        <Button
                          key={asset}
                          variant="text"
                          onClick={() => setSelectedAsset(asset)}
                        >
                          {asset}
                        </Button>
                      ),
                    )}
                  </span>
                  <i>→</i>
                  <span>
                    <small>Portfolio impact</small>
                    <b className="negative">-₹{loss.toFixed(1)} Cr</b>
                  </span>
                </div>
                <span className="prototype-label">
                  Illustrative event-specific model output
                </span>
              </section>
            )}
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
                      <th>Modeled loss</th>
                      <th>Contribution</th>
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
                        <td className="negative">
                          ₹{((loss * asset.share) / 100).toFixed(1)} Cr
                        </td>
                        <td>{asset.share}%</td>
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
                  <b className="negative">-₹{loss.toFixed(1)} Cr</b>
                </span>
                <span>
                  <small>Portfolio impact</small>
                  <b className="negative">-{(loss / 24.5).toFixed(1)}%</b>
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
                  {Object.keys(defaultScenarioData).map((name) => (
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
            <Button onClick={() => {
              setApplied(controls)
              if (portfolioId) {
                setRunComplete(false)
                import("../services/api").then(({ riskApi }) => {
                  riskApi.runStressTest(portfolioId, controls, (stressRun as any)?.scenarioId, triggerEvent?.id)
                    .then(res => {
                      setBackendResult(res)
                      setRunComplete(true)
                    })
                    .catch(err => {
                      console.error(err)
                      setRunComplete(true)
                    })
                })
              }
            }}>
              Recalculate Stress Test <Icon name="arrow" size={15} />
            </Button>
          </aside>
        </div>
      )}
      <section className="stress-history-panel">
        <PanelTitle
          title="Stress Test History"
          subtitle="Completed event-specific portfolio stress tests"
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
        {history.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Classification</th>
                  <th>Impact</th>
                  <th>Scenario</th>
                  <th>Portfolio loss</th>
                  <th>Loss %</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.runId} onClick={() => onOpenHistory(entry)}>
                    <td>
                      <strong>{entry.event.title}</strong>
                    </td>
                    <td>{titleCase(entry.event.category)}</td>
                    <td>{entry.event.impact.toFixed(1)}</td>
                    <td>{entry.scenario}</td>
                    <td className="negative">-₹{entry.loss.toFixed(1)} Cr</td>
                    <td className="negative">
                      -{(entry.loss / 24.5).toFixed(1)}%
                    </td>
                    <td>
                      <span className="history-status">
                        <i /> Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <strong>No completed event stress tests</strong>
            <span>
              Run a stress test from any Risk Intelligence event to create
              history.
            </span>
          </div>
        )}
      </section>
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
          scenario={scenario}
          onClose={() => setWhyLossOpen(false)}
        />
      )}
      {comparisonOpen && (
        <ScenarioComparisonDialog onClose={() => setComparisonOpen(false)} />
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
