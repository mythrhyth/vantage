import React, { useState, useEffect, useMemo } from "react"
import {
  Page,
  IconName,
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "../../types"
import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
  generateEventStressParameters,
  calculateScenarioLoss,
} from "../../utils"
import { Icon } from "../common/Icon"
import { Button } from "../common/Button"
import { PanelTitle } from "../common/PanelTitle"
import { Slider } from "../common/Slider"
import { Summary } from "../common/Summary"
import { PageHeading } from "../common/PageHeading"

export function AssetLossDialog({
  asset,
  loss,
  onClose,
}: {
  asset: AssetName
  loss: number
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const details = {
    Loans: {
      exposure: "₹1,360 Cr",
      share: 47,
      driver: "Default probability",
      reason:
        "The scenario increases modeled default probability. Because the portfolio has significant loan exposure, higher expected credit losses produce the largest contribution to total portfolio loss.",
      chain: [
        "Default probability ↑",
        "Expected credit losses ↑",
        "Loan portfolio loss ↑",
        "Total stress loss",
      ],
    },
    Bonds: {
      exposure: "₹800 Cr",
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
      exposure: "₹290 Cr",
      share: 12,
      driver: "Counterparty exposure",
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
