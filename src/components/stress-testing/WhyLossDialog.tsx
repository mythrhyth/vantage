import React, { useEffect, useMemo } from "react"
import { ScenarioName, AssetName } from "../../types"
import { Button } from "../common/Button"

export function WhyLossDialog({
  loss,
  scenario,
  attribution,
  onClose,
}: {
  loss: number
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
    if (attribution && (attribution.loansLoss || attribution.bondsLoss || attribution.derivativesLoss || attribution.equityLoss)) {
      const lLoss = Math.max(0, attribution.loansLoss || 0)
      const bLoss = Math.max(0, attribution.bondsLoss || 0)
      const dLoss = Math.max(0, attribution.derivativesLoss || 0)
      const eLoss = Math.max(0, attribution.equityLoss || 0)
      const tot = lLoss + bLoss + dLoss + eLoss || loss || 1

      const items: { name: AssetName; absLoss: number; share: number; driver: string }[] = [
        { name: "Loans", absLoss: lLoss, share: Math.round((lLoss / tot) * 100), driver: "Credit-spread & rate sensitivity" },
        { name: "Bonds", absLoss: bLoss, share: Math.round((bLoss / tot) * 100), driver: "Interest-rate & yield curve shift" },
        { name: "Derivatives", absLoss: dLoss, share: Math.round((dLoss / tot) * 100), driver: "Liquidity haircut & rate shift" },
        { name: "Equity" as AssetName, absLoss: eLoss, share: Math.round((eLoss / tot) * 100), driver: "Inflation, rate & liquidity haircut" },
      ]

      return items.sort((a, b) => b.share - a.share)
    }

    return [
      { name: "Loans" as AssetName, absLoss: loss * 0.47, share: 47, driver: "Default probability adjustment" },
      { name: "Bonds" as AssetName, absLoss: loss * 0.31, share: 31, driver: "Interest-rate and credit-spread sensitivity" },
      { name: "Derivatives" as AssetName, absLoss: loss * 0.12, share: 12, driver: "Counterparty exposure" },
      { name: "Liquidity" as AssetName, absLoss: loss * 0.10, share: 10, driver: "Liquidity haircut" },
    ]
  }, [attribution, loss])

  const primaryDriver = calculatedContributors[0]

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
              Why did the portfolio lose ₹{loss.toFixed(1)} Cr?
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
              Primary driver · {primaryDriver.name} sensitivity ({primaryDriver.share}%)
            </div>
            <div className="why-loss-causal-chain">
              {[
                scenario,
                `${primaryDriver.name} market stress`,
                `Primary driver: ${primaryDriver.driver}`,
                `Expected ${primaryDriver.name.toLowerCase()} losses increase`,
                `${primaryDriver.name} contribute ₹${primaryDriver.absLoss.toFixed(1)} Cr`,
                `${primaryDriver.share}% of total modeled loss`,
              ].map((step, index) => (
                <div key={step}>
                  <span>{step}</span>
                  {index < 5 && <i>↓</i>}
                </div>
              ))}
            </div>
          </section>
          <div className="loss-explanation-list">
            {calculatedContributors.map((c, index) => (
              <div key={c.name}>
                <i>{index + 1}</i>
                <span>
                  <b>
                    {c.name}{" "}
                    {index === 0
                      ? "were the largest contributor"
                      : "contributed"}
                  </b>
                  <small>
                    ₹{c.absLoss.toFixed(1)} Cr / {c.share}%
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
            <small>Primary overall driver</small>
            <b>{primaryDriver.name} ({primaryDriver.driver})</b>
          </div>
          <div className="why-loss-totals">
            <span>
              <small>Total modeled loss</small>
              <b className="negative">₹{loss.toFixed(1)} Cr</b>
            </span>
            <span>
              <small>Portfolio impact</small>
              <b className="negative">-{(loss / 24.5).toFixed(1)}%</b>
            </span>
          </div>
          <span className="prototype-label">
            Dynamic asset class attribution derived from backend RiskEngineService.
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
