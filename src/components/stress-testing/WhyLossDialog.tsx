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

export function WhyLossDialog({
  loss,
  scenario,
  onClose,
}: {
  loss: number
  scenario: ScenarioName
  onClose: () => void
}) {
  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const contributors: [AssetName, number, string][] = [
    ["Loans", 47, "Default probability adjustment"],
    ["Bonds", 31, "Interest-rate and credit-spread sensitivity"],
    ["Derivatives", 12, "Counterparty exposure"],
    ["Liquidity", 10, "Liquidity haircut"],
  ]

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
              Primary driver · Loan credit risk
            </div>
            <div className="why-loss-causal-chain">
              {[
                scenario,
                "Higher borrowing / credit stress",
                "Default probability increases",
                "Expected loan losses increase",
                `Loans contribute ₹${(loss * 0.47).toFixed(1)} Cr`,
                "47% of total modeled loss",
              ].map((step, index) => (
                <div key={step}>
                  <span>{step}</span>
                  {index < 5 && <i>↓</i>}
                </div>
              ))}
            </div>
          </section>
          <div className="loss-explanation-list">
            {contributors.map(([name, share, driver], index) => (
              <div key={name}>
                <i>{index + 1}</i>
                <span>
                  <b>
                    {name}{" "}
                    {index === 0
                      ? "were the largest contributor"
                      : "contributed"}
                  </b>
                  <small>
                    ₹{((loss * share) / 100).toFixed(1)} Cr / {share}%
                  </small>
                </span>
                <span>
                  <small>Main driver</small>
                  <b>{driver}</b>
                </span>
              </div>
            ))}
          </div>
          <div className="primary-overall-driver">
            <small>Primary overall driver</small>
            <b>Loan credit risk</b>
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
            Asset allocation is a prototype attribution based on the existing
            modeled loss split.
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
