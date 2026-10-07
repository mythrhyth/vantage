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

export function AllocationExplanationDialog({
  stock,
  assets,
  proposed,
  allProposed,
  sensitivity,
  maxWeight,
  maxChange,
  sectorLimit,
  cost,
  onClose,
}: {
  assets?: any[]
  stock: any
  proposed: number
  allProposed: number[]
  sensitivity: number
  maxWeight: number
  maxChange: number
  sectorLimit: number
  cost: number
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  const change = proposed - stock.current
  const desired = stock.current + ((stock.sentiment * sensitivity) / 100) * 1.25
  const maxWeightBinding = desired > maxWeight
  const fullSignalChange = Math.abs(
    (stock.sentiment * sensitivity * 1.25) / 100,
  )
  const appliedSignalChange = Math.abs(
    (stock.sentiment * sensitivity * Math.min(1.25, maxChange)) / 100,
  )
  const maxChangeBinding = appliedSignalChange + 0.001 < fullSignalChange
  const sectorExposure = (assets || []).reduce(
    (sum, item, index) =>
      item.sector === stock.sector ? sum + (allProposed[index] ?? 0) : sum,
    0,
  )
  const sectorBinding = false
  const bindingConstraints = [
    maxWeightBinding ? "maximum stock weight" : "",
    maxChangeBinding ? "maximum allocation change" : "",
    sectorBinding ? "sector exposure limit" : "",
  ].filter(Boolean)
  const direction =
    change > 0.05 ? "increased" : change < -0.05 ? "decreased" : "maintained"
  const signalDirection = stock.sentiment >= 0 ? "positive" : "negative"
  const sentimentStrength =
    Math.abs(stock.sentiment) >= 0.6
      ? "Strong"
      : Math.abs(stock.sentiment) >= 0.25
        ? "Moderate"
        : "Mild"
  const constraintSummary = bindingConstraints.length
    ? `The final weight was limited by the ${bindingConstraints.join(" and ")} constraint${
        bindingConstraints.length > 1 ? "s" : ""
      }.`
    : "The available stock-level and sector-level constraints were checked and were not binding."
  const factorDirection = change >= 0 ? "Increase" : "Decrease"

  const constraints = [
    {
      label: "Maximum stock weight",
      value: `${maxWeight}%`,
      binding: maxWeightBinding,
      detail: maxWeightBinding
        ? `The unconstrained desired weight of ${desired.toFixed(1)}% exceeded this limit.`
        : `The desired weight remained below ${maxWeight}%.`,
    },
    {
      label: "Maximum allocation change",
      value: `${maxChange}%`,
      binding: maxChangeBinding,
      detail: maxChangeBinding
        ? "The optimizer's full sentiment response exceeded the configured change allowance."
        : "The proposed adjustment remained within the configured allowance.",
    },
    {
      label: "Sector exposure limit",
      value: `${sectorLimit}%`,
      binding: sectorBinding,
      detail: `${stock.sector} exposure is ${sectorExposure.toFixed(1)}% after allocation.`,
    },
  ]

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => {
        if (input.target === input.currentTarget) onClose()
      }}
    >
      <section
        className="explainability-dialog allocation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="allocation-explanation-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">
              Stock allocation explainability
            </span>
            <div className="dialog-title" id="allocation-explanation-title">
              {stock.ticker} — Allocation Explanation
            </div>
            <span className="dialog-meta">{stock.legalName}</span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close allocation explanation"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="allocation-dialog-summary">
          <span>
            <small>Current weight</small>
            <b>{stock.current.toFixed(1)}%</b>
          </span>
          <span>
            <small>Proposed weight</small>
            <b>{proposed.toFixed(1)}%</b>
          </span>
          <span>
            <small>Change</small>
            <b className={change >= 0 ? "positive" : "negative"}>
              {signedValue(change)}%
            </b>
          </span>
        </div>

        <div className="explainability-body">
          <section className="dialog-section allocation-primary-reason">
            <div className="dialog-section-title">
              Why did the allocation change?
            </div>
            <p>
              {stock.ticker} has a {sentimentStrength.toLowerCase()}{" "}
              {signalDirection} sentiment signal (
              {signedValue(stock.sentiment, 2)}). With sentiment sensitivity set
              to {sensitivity}%, the optimizer {direction} the desired exposure.{" "}
              {constraintSummary} Portfolio normalization resulted in a proposed
              weight of {proposed.toFixed(1)}%.
            </p>
          </section>

          <section className="dialog-section allocation-flow-section">
            <div className="dialog-section-title">Decision flow</div>
            <div className="allocation-decision-flow">
              {[
                ["Current weight", `${stock.current.toFixed(1)}%`],
                ["Sentiment signal", signedValue(stock.sentiment, 2)],
                ["Sentiment sensitivity", `${sensitivity}%`],
                ["Desired allocation", `${desired.toFixed(1)}%`],
                [
                  "Constraint check",
                  bindingConstraints.length
                    ? `${bindingConstraints.length} binding`
                    : "No binding limits",
                ],
                ["Proposed weight", `${proposed.toFixed(1)}%`],
              ].map(([label, value], index) => (
                <div className="allocation-flow-step" key={label}>
                  <span>
                    <small>{label}</small>
                    <b>{value}</b>
                  </span>
                  {index < 5 && <i>→</i>}
                </div>
              ))}
            </div>
            <span className="flow-caption">
              Signal → Optimizer → Constraints → Final allocation
            </span>
          </section>

          <div className="dialog-two-column">
            <section className="dialog-section">
              <div className="dialog-section-title">Sentiment signal</div>
              <div className="allocation-signal-head">
                <span>
                  <small>Sentiment</small>
                  <b className={stock.sentiment >= 0 ? "positive" : "negative"}>
                    {signedValue(stock.sentiment, 2)}
                  </b>
                </span>
                <strong>
                  {sentimentStrength} {signalDirection}
                </strong>
              </div>
              <div className="sentiment-scale">
                <i
                  className="sentiment-marker"
                  style={{ left: `${((stock.sentiment + 1) / 2) * 100}%` }}
                />
              </div>
              <div className="sentiment-scale-labels">
                <span>-1 Negative</span>
                <span>0 Neutral</span>
                <span>+1 Positive</span>
              </div>
              <div className="sensitivity-explanation">
                <span>
                  <small>Sentiment sensitivity</small>
                  <b>{sensitivity}%</b>
                </span>
                <p>
                  Controls how strongly the allocation optimizer responds to
                  sentiment.
                </p>
              </div>
            </section>

            <section className="dialog-section">
              <div className="dialog-section-title">Allocation comparison</div>
              <div className="allocation-comparison">
                <div>
                  <span>
                    <small>Current</small>
                    <b>{stock.current.toFixed(1)}%</b>
                  </span>
                  <i>
                    <b
                      style={{ width: `${(stock.current / maxWeight) * 100}%` }}
                    />
                  </i>
                </div>
                <div>
                  <span>
                    <small>Proposed</small>
                    <b>{proposed.toFixed(1)}%</b>
                  </span>
                  <i>
                    <b style={{ width: `${(proposed / maxWeight) * 100}%` }} />
                  </i>
                </div>
              </div>
              <strong
                className={
                  change >= 0
                    ? "comparison-change positive"
                    : "comparison-change negative"
                }
              >
                {signedValue(change)} percentage points
              </strong>
            </section>
          </div>

          <section className="dialog-section constraint-section">
            <div className="dialog-section-title">Portfolio constraints</div>
            <div className="constraint-grid">
              {constraints.map((constraint) => (
                <div
                  className={constraint.binding ? "binding" : ""}
                  key={constraint.label}
                >
                  <span>
                    <small>{constraint.label}</small>
                    <b>{constraint.value}</b>
                  </span>
                  <strong className={constraint.binding ? "risk" : "positive"}>
                    {constraint.binding ? "Constraint applied" : "Not binding"}
                  </strong>
                  <p>{constraint.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="dialog-section why-not-section">
            <div className="dialog-section-title">
              Why not a larger {stock.sentiment >= 0 ? "increase" : "decrease"}?
            </div>
            <p>
              The {signalDirection} sentiment supports a{" "}
              {stock.sentiment >= 0 ? "higher" : "lower"} allocation, but the
              optimizer also accounts for existing exposure, relative signals
              across the portfolio, normalization, and transaction costs.{" "}
              {bindingConstraints.length
                ? `The ${bindingConstraints.join(" and ")} constraint${
                    bindingConstraints.length > 1 ? "s were" : " was"
                  } also binding.`
                : "No configured portfolio constraint directly capped this stock's final weight."}
            </p>
          </section>

          <div className="dialog-two-column allocation-audit-grid">
            <section className="dialog-section">
              <div className="dialog-section-title">Decision factors</div>
              <div className="decision-factor-table">
                {[
                  ["Sentiment", factorDirection, change >= 0 ? "up" : "down"],
                  [
                    "Sentiment sensitivity",
                    `${
                      sensitivity < 40
                        ? "Low"
                        : sensitivity < 75
                          ? "Moderate"
                          : "High"
                    } influence`,
                    "neutral",
                  ],
                  ["Current weight", "Existing exposure", "neutral"],
                  [
                    "Maximum stock weight",
                    maxWeightBinding
                      ? "Binding constraint"
                      : "Available constraint",
                    maxWeightBinding ? "limit" : "neutral",
                  ],
                  [
                    "Maximum allocation change",
                    maxChangeBinding
                      ? "Binding constraint"
                      : "Available constraint",
                    maxChangeBinding ? "limit" : "neutral",
                  ],
                  [
                    "Sector exposure",
                    sectorBinding
                      ? "Binding constraint"
                      : "Available constraint",
                    sectorBinding ? "limit" : "neutral",
                  ],
                  ["Transaction cost", "Trading penalty", "limit"],
                ].map(([factor, effect, tone]) => (
                  <span key={factor}>
                    <b>{factor}</b>
                    <small className={`factor-${tone}`}>
                      {tone === "up"
                        ? "↑ "
                        : tone === "down"
                          ? "↓ "
                          : tone === "limit"
                            ? "— "
                            : ""}
                      {effect}
                    </small>
                  </span>
                ))}
              </div>
            </section>

            <section className="dialog-section">
              <div className="dialog-section-title">Portfolio impact</div>
              <div className="portfolio-impact-list">
                <span>
                  <small>Current weight</small>
                  <b>{stock.current.toFixed(1)}%</b>
                </span>
                <span>
                  <small>Proposed weight</small>
                  <b>{proposed.toFixed(1)}%</b>
                </span>
                <span>
                  <small>Change</small>
                  <b className={change >= 0 ? "positive" : "negative"}>
                    {signedValue(change)}%
                  </b>
                </span>
                <span>
                  <small>Estimated turnover contribution</small>
                  <b>{Math.abs(change).toFixed(2)}%</b>
                </span>
                <span>
                  <small>Estimated transaction cost</small>
                  <b>{((Math.abs(change) * cost) / 100).toFixed(2)}%</b>
                </span>
                <span>
                  <small>Sector</small>
                  <b>{stock.sector}</b>
                </span>
                <span>
                  <small>Sector exposure after allocation</small>
                  <b>{sectorExposure.toFixed(1)}%</b>
                </span>
              </div>
            </section>
          </div>

          <section className="dialog-section allocation-rationale">
            <div className="dialog-section-title">Allocation rationale</div>
            <p>
              {titleCase(signalDirection)} sentiment is driving a{" "}
              {Math.abs(change) < 0.15 ? "limited" : "modest"}{" "}
              {change >= 0 ? "increase" : "decrease"} in {stock.ticker}{" "}
              exposure. The optimizer adjusted the position while checking the
              portfolio's stock-level, sector-level, and trading constraints.
            </p>
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
