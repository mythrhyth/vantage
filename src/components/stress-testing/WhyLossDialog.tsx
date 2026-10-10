import React, { useEffect, useMemo } from "react"
import { ScenarioName, AssetName } from "../../types"
import { Button } from "../common/Button"

export function WhyLossDialog({
  loss,
  baseline = 2450,
  scenario,
  attribution,
  onClose,
}: {
  loss: number
  baseline?: number
  scenario: ScenarioName
  attribution?: {
    loansLoss?: number
    bondsLoss?: number
    derivativesLoss?: number
    equityLoss?: number
  }
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const calculatedContributors = useMemo(() => {
    const rawLoans = attribution?.loansLoss ?? 0
    const rawBonds = attribution?.bondsLoss ?? 0
    const rawDeriv = attribution?.derivativesLoss ?? 0
    const rawEquity = attribution?.equityLoss ?? 0

    const grossLoss = Math.max(0, rawLoans) + Math.max(0, rawBonds) + Math.max(0, rawDeriv) + Math.max(0, rawEquity)

    const rawItems = [
      { name: "Loans" as AssetName, rawVal: rawLoans, driver: "Credit-spread & rate sensitivity" },
      { name: "Bonds" as AssetName, rawVal: rawBonds, driver: "Interest-rate & yield curve shift" },
      { name: "Derivatives" as AssetName, rawVal: rawDeriv, driver: "Liquidity haircut & rate shift" },
      { name: "Equity" as AssetName, rawVal: rawEquity, driver: "Inflation, rate & liquidity sensitivity" },
    ]

    const items = rawItems.map((item) => {
      const isLoss = item.rawVal > 0
      const isGain = item.rawVal < 0
      const absVal = Math.abs(item.rawVal)
      const share = isLoss && grossLoss > 0 ? Math.round((item.rawVal / grossLoss) * 100) : 0
      return {
        ...item,
        isLoss,
        isGain,
        absVal,
        share,
      }
    })

    // Sort by gross loss share descending, keeping gaining assets visible
    return {
      grossLoss,
      items: items.sort((a, b) => b.share - a.share || b.rawVal - a.rawVal),
    }
  }, [attribution, loss])

  const { grossLoss, items: contributors } = calculatedContributors

  const primaryDriver = contributors.find((c) => c.isLoss) || contributors[0] || {
    name: "Loans" as AssetName,
    share: 0,
    rawVal: 0,
    absVal: 0,
    isLoss: false,
    isGain: false,
    driver: "Credit sensitivity",
  }

  const isNetGain = loss === 0 && contributors.some((c) => c.isGain)

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => input.target === input.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog why-loss-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-loss-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Executive loss explanation</span>
            <div className="dialog-title" id="why-loss-title">
              {loss > 0
                ? `Why did the portfolio lose ₹${loss.toFixed(1)} Cr?`
                : isNetGain
                ? `Portfolio Stress Analysis — Net Capital Gain / Zero Loss`
                : `Why did the portfolio report ₹0.0 Cr stress loss?`}
            </div>
            <span className="dialog-meta">
              Modeled 12-month scenario impact
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close loss explanation"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <section className="dialog-section why-loss-causal-card">
            <div className="dialog-section-title">
              {primaryDriver.isLoss
                ? `Primary loss driver · ${primaryDriver.name} sensitivity (${primaryDriver.share}% of gross loss)`
                : `Primary asset exposure · ${primaryDriver.name}`}
            </div>
            <div className="why-loss-causal-chain">
              {[
                scenario,
                `${primaryDriver.name} market stress`,
                `Primary driver: ${primaryDriver.driver}`,
                primaryDriver.isLoss
                  ? `Expected ${primaryDriver.name.toLowerCase()} losses: ₹${primaryDriver.rawVal.toFixed(1)} Cr`
                  : primaryDriver.isGain
                  ? `Expected ${primaryDriver.name.toLowerCase()} capital gain: +₹${primaryDriver.absVal.toFixed(1)} Cr`
                  : `No significant ${primaryDriver.name.toLowerCase()} change`,
                primaryDriver.isLoss
                  ? `${primaryDriver.share}% of gross asset class losses (₹${grossLoss.toFixed(1)} Cr gross)`
                  : `Asset capital gain offsets portfolio stress losses`,
                loss > 0
                  ? `Net portfolio stress loss: ₹${loss.toFixed(1)} Cr`
                  : `Net portfolio stress loss: ₹0.0 Cr`,
              ].map((step, index) => (
                <div key={step}>
                  <span>{step}</span>
                  {index < 5 && <i>↓</i>}
                </div>
              ))}
            </div>
          </section>

          <div className="loss-explanation-list">
            {contributors.map((c, index) => (
              <div key={c.name}>
                <i>{index + 1}</i>
                <span>
                  <b>
                    {c.name}{" "}
                    {c.isLoss
                      ? index === 0
                        ? "was the largest loss contributor"
                        : "contributed to stress loss"
                      : c.isGain
                      ? "generated a capital gain (loss offset)"
                      : "had no stress impact"}
                  </b>
                  <small>
                    {c.isLoss ? (
                      `₹${c.rawVal.toFixed(1)} Cr loss / ${c.share}% gross loss`
                    ) : c.isGain ? (
                      <span className="positive">+₹{c.absVal.toFixed(1)} Cr gain (offset)</span>
                    ) : (
                      `₹0.0 Cr`
                    )}
                  </small>
                </span>
                <span>
                  <small>Main driver</small>
                  <b>{c.driver}</b>
                </span>
              </div>
            ))}
          </div>

          <div className="primary-overall-driver">
            <small>Primary overall factor</small>
            <b>
              {primaryDriver.name} ({primaryDriver.driver})
            </b>
          </div>

          <div className="why-loss-totals">
            <span>
              <small>Net portfolio stress loss</small>
              <b className={loss > 0 ? "negative" : ""}>
                {loss > 0 ? `₹${loss.toFixed(1)} Cr` : "₹0.0 Cr"}
              </b>
            </span>
            <span>
              <small>Gross asset losses</small>
              <b className={grossLoss > 0 ? "negative" : ""}>
                ₹{grossLoss.toFixed(1)} Cr
              </b>
            </span>
            <span>
              <small>Portfolio impact</small>
              <b className={loss > 0 ? "negative" : ""}>
                {loss > 0
                  ? `-${(baseline > 0 ? (loss / baseline) * 100 : 0).toFixed(1)}%`
                  : "0.0%"}
              </b>
            </span>
          </div>
          <span className="prototype-label">
            Dynamic asset class attribution derived directly from backend RiskEngineService.
          </span>
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
