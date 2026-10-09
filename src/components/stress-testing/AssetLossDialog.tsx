import React, { useEffect } from "react"
import { AssetName } from "../../types"
import { Button } from "../common/Button"

export function AssetLossDialog({
  asset,
  loss,
  attribution,
  onClose,
}: {
  asset: AssetName
  loss: number
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

  const dynamicShares = (() => {
    if (attribution && (attribution.loansLoss || attribution.bondsLoss || attribution.derivativesLoss || attribution.equityLoss)) {
      const lLoss = Math.max(0, attribution.loansLoss || 0)
      const bLoss = Math.max(0, attribution.bondsLoss || 0)
      const dLoss = Math.max(0, attribution.derivativesLoss || 0)
      const eLoss = Math.max(0, attribution.equityLoss || 0)
      const tot = lLoss + bLoss + dLoss + eLoss || loss || 1

      return {
        Loans: { share: Math.round((lLoss / tot) * 100), absLoss: lLoss },
        Bonds: { share: Math.round((bLoss / tot) * 100), absLoss: bLoss },
        Derivatives: { share: Math.round((dLoss / tot) * 100), absLoss: dLoss },
        Liquidity: { share: Math.round((eLoss / tot) * 100), absLoss: eLoss },
      }
    }
    return null
  })()

  const defaultDetails = {
    Loans: {
      exposure: "Portfolio Loans",
      share: 47,
      driver: "Credit-spread & rate sensitivity",
      reason:
        "Higher credit spreads and benchmark rate shifts increase expected credit loss allowances and discount rates, reducing modeled loan valuations.",
      chain: [
        "Credit spread & rate shift ↑",
        "Discount rates & expected credit loss ↑",
        "Loan portfolio valuation decline",
        "Total stress loss contribution",
      ],
    },
    Bonds: {
      exposure: "Portfolio Fixed Income",
      share: 31,
      driver: "Rate and spread duration",
      reason:
        "Higher interest rates and wider credit spreads increase discount rates and required yields, reducing the modeled value of fixed-income positions.",
      chain: [
        "Interest rates and credit spreads ↑",
        "Required bond yields ↑",
        "Bond valuations decline",
        "Bond portfolio loss",
      ],
    },
    Derivatives: {
      exposure: "Portfolio Derivatives",
      share: 12,
      driver: "Liquidity haircut & rate shift",
      reason:
        "Market and rate stress changes mark-to-market values and increases modeled counterparty exposure across the derivatives portfolio.",
      chain: [
        "Market and rate stress",
        "Mark-to-market and counterparty exposure",
        "Derivative loss",
        "Total stress loss",
      ],
    },
    Liquidity: {
      exposure: "Portfolio-wide",
      share: 10,
      driver: "Liquidity haircut",
      reason:
        "The configured liquidity haircut reduces modeled exit values and adds a portfolio-wide liquidity adjustment to the stress loss.",
      chain: [
        "Liquidity haircut",
        "Reduced modeled exit values",
        "Liquidity adjustment",
        "Total stress loss",
      ],
    },
  }[asset]

  const details = {
    ...defaultDetails,
    share: dynamicShares && dynamicShares[asset as keyof typeof dynamicShares] !== undefined
      ? dynamicShares[asset as keyof typeof dynamicShares].share
      : defaultDetails.share
  }

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => input.target === input.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog asset-loss-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-loss-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Asset-class explainability</span>
            <div className="dialog-title" id="asset-loss-title">
              {asset}
            </div>
            <span className="dialog-meta">
              Primary driver · {details.driver}
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close asset-class explanation"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <div className="asset-detail-metrics">
            <span>
              <small>Exposure</small>
              <b>{details.exposure}</b>
            </span>
            <span>
              <small>Modeled loss</small>
              <b className="negative">
                ₹{((loss * details.share) / 100).toFixed(1)} Cr
              </b>
            </span>
            <span>
              <small>Contribution</small>
              <b>{details.share}%</b>
            </span>
          </div>
          <section className="dialog-section asset-reason-card">
            <div className="dialog-section-title">
              Why did {asset.toLowerCase()} lose value?
            </div>
            <p>{details.reason}</p>
          </section>
          <section className="dialog-section">
            <div className="dialog-section-title">Cause and effect</div>
            <div className="asset-causal-chain">
              {details.chain.map((step, index) => (
                <div key={step}>
                  <span>{step}</span>
                  {index < details.chain.length - 1 && <i>↓</i>}
                </div>
              ))}
            </div>
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
