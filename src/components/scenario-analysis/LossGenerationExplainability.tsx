import React, { useState } from "react"
import { PanelTitle } from "../common/PanelTitle"
import { Icon } from "../common/Icon"
import { Button } from "../common/Button"

export interface LossGenerationExplainabilityProps {
  backendResult?: any
  scenarioName?: string
  runType?: string
  controls?: Record<string, number>
  portfolioMeta?: any
}

export function LossGenerationExplainability({
  backendResult,
  scenarioName = "Interest Rate Shock",
  runType = "manual",
  controls = {},
  portfolioMeta,
}: LossGenerationExplainabilityProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  const baseline = Number(backendResult?.baseline_value ?? portfolioMeta?.baselineValue ?? 1000)
  const loss = Number(backendResult?.absolute_loss ?? 0)
  const stressed = Number(backendResult?.stressed_value ?? Math.max(0, baseline - loss))
  const lossPct = baseline > 0 ? (loss / baseline) * 100 : 0

  const attribution = backendResult?.attribution_result || {}
  const trace = attribution.calculation_trace || {}
  const traceDrivers = trace.drivers || []

  // Asset class losses directly from canonical backend attribution
  const loansLoss = Number(attribution.loansLoss ?? 0)
  const bondsLoss = Number(attribution.bondsLoss ?? 0)
  const derivativesLoss = Number(attribution.derivativesLoss ?? 0)
  const equityLoss = Number(attribution.equityLoss ?? 0)

  // Invariant verification: baseline - loss = stressed
  const isReconciled = Math.abs(baseline - loss - stressed) < 0.1

  // Format driver rows with fallback to supported backend factors if trace not available
  const driversToRender = traceDrivers.length > 0
    ? traceDrivers.filter((d: any) => Math.abs(d.modeled_loss) > 0 || Math.abs(d.normalized_val) > 0)
    : [
        {
          driver_key: "interest_rate",
          label: "Interest-Rate Shock",
          raw_input: `${(controls.rate ?? 250) >= 0 ? "+" : ""}${controls.rate ?? 250} bps`,
          affected_asset_classes: ["Bonds", "Derivatives", "Loans"],
          affected_exposure: Number(portfolioMeta?.bondsExposure || 170) + Number(portfolioMeta?.derivativesExposure || 100) + Number(portfolioMeta?.loansExposure || 300),
          formula: "Bonds (0.50 × Δr) + Deriv (0.20 × |Δr|) + Loans (0.10 × Δr)",
          modeled_loss: Number(attribution.factors?.find((f: any) => f.factor === "interest_rate")?.loss ?? (bondsLoss * 0.7)),
          is_shared: true,
          assumptions: "Duration contraction on fixed income; interest rate swap mark-to-market adjustments."
        },
        {
          driver_key: "spread",
          label: "Credit-Spread Shock",
          raw_input: `+${controls.spread ?? 120} bps`,
          affected_asset_classes: ["Loans", "Bonds"],
          affected_exposure: Number(portfolioMeta?.loansExposure || 300) + Number(portfolioMeta?.bondsExposure || 170),
          formula: "Loans (0.40 × Δs) + Bonds (0.20 × Δs)",
          modeled_loss: Number(attribution.factors?.find((f: any) => f.factor === "spread")?.loss ?? (loansLoss * 0.6)),
          is_shared: true,
          assumptions: "Expansion of credit risk premiums across corporate loans and unrated bond holdings."
        },
        {
          driver_key: "default_probability",
          label: "Default-Probability Adjustment",
          raw_input: `${controls.probability ?? 2}%`,
          affected_asset_classes: ["Loans"],
          affected_exposure: Number(portfolioMeta?.loansExposure || 300),
          formula: "Loans (0.40 × ΔPD)",
          modeled_loss: Number(attribution.factors?.find((f: any) => f.factor === "default_probability")?.loss ?? (loansLoss * 0.3)),
          is_shared: false,
          assumptions: "Expected credit default provisioning on commercial loan exposures."
        },
        {
          driver_key: "liquidity",
          label: "Liquidity Haircut",
          raw_input: `${controls.liquidity ?? 8}%`,
          affected_asset_classes: ["Derivatives", "Equity"],
          affected_exposure: Number(portfolioMeta?.derivativesExposure || 100) + Number(portfolioMeta?.equityExposure || 430),
          formula: "Derivatives (0.60 × H_liq) + Equity (0.10 × H_liq)",
          modeled_loss: Number(attribution.factors?.find((f: any) => f.factor === "liquidity")?.loss ?? derivativesLoss),
          is_shared: true,
          assumptions: "Market illiquidity haircuts applied to derivative collateral and equity positions."
        },
        {
          driver_key: "inflation",
          label: "Inflation Shock",
          raw_input: `${(controls.inflation ?? 150) >= 0 ? "+" : ""}${controls.inflation ?? 150} bps`,
          affected_asset_classes: ["Bonds", "Equity"],
          affected_exposure: Number(portfolioMeta?.bondsExposure || 170) + Number(portfolioMeta?.equityExposure || 430),
          formula: "Bonds (0.20 × Δπ) + Equity (0.20 × Δπ)",
          modeled_loss: Number(attribution.factors?.find((f: any) => f.factor === "inflation")?.loss ?? 0),
          is_shared: true,
          assumptions: "Real discount rate shifts eroding bond market values and equity earnings multiples."
        }
      ]

  const toggleExpand = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }

  const badgeText = runType === "event_driven"
    ? `Event Driven · ${scenarioName}`
    : runType === "preset"
    ? `Preset · ${scenarioName}`
    : runType === "default"
    ? "Default Parameters"
    : `Manual · ${scenarioName}`

  return (
    <section className="risk-factor-panel loss-explainability-panel">
      <PanelTitle
        title="How the loss was generated"
        subtitle="From scenario assumptions to modeled portfolio impact"
        side={
          <span className="severity-badge">
            {badgeText}
          </span>
        }
      />

      <div className="table-wrap">
        <table className="explainability-table">
          <thead>
            <tr>
              <th>Scenario Assumption</th>
              <th className="col-exposure">Affected Exposure</th>
              <th className="text-right">Modeled Contribution</th>
              <th className="text-center" style={{ width: "90px" }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {driversToRender.map((driver: any) => {
              const isExpanded = expandedKey === driver.driver_key
              const isLoss = driver.modeled_loss > 0
              const isGain = driver.modeled_loss < 0

              return (
                <React.Fragment key={driver.driver_key}>
                  <tr className={isExpanded ? "selected-row" : ""}>
                    <td>
                      <div className="driver-name">{driver.label}</div>
                      <span className="driver-input">Input: {driver.raw_input}</span>
                      <div className="exposure-sub-mobile">
                        <div className="asset-tags">
                          {driver.affected_asset_classes.map((ac: string) => (
                            <span key={ac} className="asset-tag">
                              {ac}
                            </span>
                          ))}
                        </div>
                        <span className="exposure-sub">
                          ₹{Number(driver.affected_exposure || 0).toFixed(1)} Cr
                        </span>
                      </div>
                    </td>
                    <td className="col-exposure">
                      <div className="asset-tags">
                        {driver.affected_asset_classes.map((ac: string) => (
                          <span key={ac} className="asset-tag">
                            {ac}
                          </span>
                        ))}
                      </div>
                      <span className="exposure-sub">
                        Exposure: ₹{Number(driver.affected_exposure || 0).toFixed(1)} Cr
                      </span>
                    </td>
                    <td className="text-right">
                      <div className={`contribution-val ${isLoss ? "negative" : isGain ? "positive" : ""}`}>
                        {isLoss ? `-₹${Math.abs(driver.modeled_loss).toFixed(1)} Cr` : isGain ? `+₹${Math.abs(driver.modeled_loss).toFixed(1)} Cr` : "₹0.0 Cr"}
                      </div>
                      {driver.is_shared && (
                        <span className="shared-driver-tag">
                          Shared Driver
                        </span>
                      )}
                    </td>
                    <td className="text-center">
                      <Button
                        variant="text"
                        ariaLabel={isExpanded ? "Hide calculation trace" : "Inspect calculation trace"}
                        onClick={() => toggleExpand(driver.driver_key)}
                        className="inspect-btn"
                      >
                        <span>{isExpanded ? "Hide" : "Inspect"}</span>
                        <Icon name="arrow" size={10} style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(90deg)", transition: "transform 0.2s" }} />
                      </Button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr id={`trace-${driver.driver_key}`} className="trace-drawer-row">
                      <td colSpan={4}>
                        <div className="trace-drawer-grid">
                          <div>
                            <div className="drawer-sub-heading">Engine Calculation Formula</div>
                            <code className="formula-code">
                              {driver.formula}
                            </code>
                            <div className="drawer-meta-line">
                              Normalized shock value: <strong>{driver.normalized_val}</strong>
                            </div>
                          </div>
                          <div>
                            <div className="drawer-sub-heading">Modeling Rationale & Assumptions</div>
                            <p className="drawer-assumptions">
                              {driver.assumptions}
                            </p>
                            <div className="drawer-meta-line">
                              Horizon scaling: <strong>{trace.horizon_multiplier ? `${trace.horizon_multiplier}x` : "1.00x"} ({trace.horizon || "1-Year"})</strong>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="total-loss-reconciliation loss-explainability-reconciliation">
        <div className="reconcile-metrics">
          <div>
            <small>Baseline Value</small>
            <b>₹{baseline.toFixed(1)} Cr</b>
          </div>
          <div className="reconcile-op">−</div>
          <div>
            <small>Net Modeled Loss</small>
            <b className={loss > 0 ? "negative" : "positive"}>
              {loss > 0 ? `-₹${loss.toFixed(1)} Cr (${lossPct.toFixed(1)}%)` : "₹0.0 Cr (0.0%)"}
            </b>
          </div>
          <div className="reconcile-op">=</div>
          <div>
            <small>Stressed Value</small>
            <b>₹{stressed.toFixed(1)} Cr</b>
          </div>
        </div>

        <div className="reconcile-status">
          {isReconciled ? (
            <span className="reconciled-badge">
              <Icon name="scenario" size={12} />
              Reconciled to Baseline
            </span>
          ) : (
            <span className="unreconciled-badge">
              ⚠️ Reconciliation Pending
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

