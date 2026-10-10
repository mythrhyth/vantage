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

  const curWeight = Number(stock.currentWeight ?? stock.current) || 0
  const propWeight = Number(proposed) || 0
  const change = propWeight - curWeight
  const desiredWeight = stock.desiredWeight !== undefined ? Number(stock.desiredWeight) : curWeight + (stock.sentiment * (sensitivity / 50) * maxChange)
  const tradeSizeVal = stock.tradeSizeVal !== undefined ? Number(stock.tradeSizeVal) : (Math.abs(change) / 100) * 2450.0
  const estimatedCostVal = (tradeSizeVal * (cost / 10000)).toFixed(2)

  const maxWeightBinding = propWeight === maxWeight && desiredWeight > maxWeight
  const maxChangeBinding = Math.abs(change) === maxChange && Math.abs(desiredWeight - curWeight) > maxChange
  const bindingConstraintName = stock.bindingConstraint || (maxWeightBinding ? "MAX_STOCK_WEIGHT_BOUND" : maxChangeBinding ? "MAX_CHANGE_BOUND" : "UNCONSTRAINED")
  const statusReason = stock.reason || "Within optimization constraints"

  const sectorExposure = (assets || []).reduce(
    (sum, item, index) =>
      item.sector === stock.sector ? sum + (allProposed[index] ?? item.current ?? 0) : sum,
    0,
  )

  const signalDirection = stock.sentiment > 0 ? "positive" : stock.sentiment < 0 ? "negative" : "neutral"
  const sentimentStrength =
    Math.abs(stock.sentiment) >= 0.6
      ? "Strong"
      : Math.abs(stock.sentiment) >= 0.25
        ? "Moderate"
        : stock.sentiment === 0
          ? "Neutral"
          : "Mild"

  const supportingEvents: any[] = stock.supportingEvents || []

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
              Stock allocation explainability & signal provenance
            </span>
            <div className="dialog-title" id="allocation-explanation-title">
              {stock.ticker} — Allocation Explanation
            </div>
            <span className="dialog-meta">{stock.company || stock.ticker} • Sector: {stock.sector}</span>
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
            <b>{curWeight.toFixed(2)}%</b>
          </span>
          <span>
            <small>Desired weight (pre-caps)</small>
            <b>{desiredWeight.toFixed(2)}%</b>
          </span>
          <span>
            <small>Proposed final weight</small>
            <b>{propWeight.toFixed(2)}%</b>
          </span>
          <span>
            <small>Weight change</small>
            <b className={change >= 0 ? "positive" : "negative"}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)} pp
            </b>
          </span>
        </div>

        <div className="explainability-body">
          <section className="dialog-section allocation-primary-reason">
            <div className="dialog-section-title">
              Why did the allocation change?
            </div>
            <p>
              <strong>{stock.ticker}</strong> exhibits a <strong>{sentimentStrength.toLowerCase()} {signalDirection}</strong> aggregated sentiment signal of <strong>{signedValue(stock.sentiment, 2)}</strong> derived from NLP news risk events.
              With sentiment sensitivity at {sensitivity}%, the unconstrained target weight was <strong>{desiredWeight.toFixed(2)}%</strong>.
              {bindingConstraintName !== 'UNCONSTRAINED' ? (
                <> The optimizer applied the <strong>{bindingConstraintName}</strong> constraint: {statusReason}.</>
              ) : (
                <> All portfolio constraints (max weight {maxWeight}%, max change ±{maxChange} pp, sector limit {sectorLimit}%) were satisfied.</>
              )}
            </p>
          </section>

          <section className="dialog-section allocation-flow-section">
            <div className="dialog-section-title">Decision flow</div>
            <div className="allocation-decision-flow">
              {[
                ["Starting weight", `${curWeight.toFixed(2)}%`],
                ["Sentiment signal", signedValue(stock.sentiment, 2)],
                ["Desired target", `${desiredWeight.toFixed(2)}%`],
                ["Binding constraint", bindingConstraintName === 'UNCONSTRAINED' ? "Satisfied" : bindingConstraintName],
                ["Final weight", `${propWeight.toFixed(2)}%`],
              ].map(([label, value], index) => (
                <div className="allocation-flow-step" key={label}>
                  <span>
                    <small>{label}</small>
                    <b>{value}</b>
                  </span>
                  {index < 4 && <i>→</i>}
                </div>
              ))}
            </div>
          </section>

          <div className="dialog-two-column">
            <section className="dialog-section">
              <div className="dialog-section-title">Execution & trade metrics</div>
              <div className="portfolio-impact-list">
                <span>
                  <small>Proposed trade size ($)</small>
                  <b>${tradeSizeVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
                <span>
                  <small>Estimated transaction cost ({cost} bps)</small>
                  <b>${estimatedCostVal}</b>
                </span>
                <span>
                  <small>Signal freshness</small>
                  <b>{stock.signalFreshnessDays !== undefined ? `${stock.signalFreshnessDays} days ago` : "Live NLP pipeline"}</b>
                </span>
                <span>
                  <small>Supporting risk signals</small>
                  <b>{stock.signalCount ?? supportingEvents.length ?? 0} events</b>
                </span>
              </div>
            </section>

            <section className="dialog-section">
              <div className="dialog-section-title">Constraint status</div>
              <div className="constraint-grid">
                <div className={maxWeightBinding ? "binding" : ""}>
                  <span>
                    <small>Maximum stock weight</small>
                    <b>{maxWeight}%</b>
                  </span>
                  <strong className={maxWeightBinding ? "risk" : "positive"}>
                    {maxWeightBinding ? "Binding cap applied" : "Satisfied"}
                  </strong>
                </div>
                <div className={maxChangeBinding ? "binding" : ""}>
                  <span>
                    <small>Maximum allocation change</small>
                    <b>±{maxChange} pp</b>
                  </span>
                  <strong className={maxChangeBinding ? "risk" : "positive"}>
                    {maxChangeBinding ? "Binding cap applied" : "Satisfied"}
                  </strong>
                </div>
              </div>
            </section>
          </div>

          {supportingEvents.length > 0 && (
            <section className="dialog-section">
              <div className="dialog-section-title">Supporting news & risk events</div>
              <div className="table-wrap">
                <table style={{ width: "100%", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th>Title / Source</th>
                      <th>Category</th>
                      <th>Sentiment</th>
                      <th>Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supportingEvents.map((ev, idx) => (
                      <tr key={ev.id || idx}>
                        <td>
                          {ev.url ? (
                            <a href={ev.url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                              <strong>{ev.title}</strong>
                            </a>
                          ) : (
                            <strong>{ev.title}</strong>
                          )}
                          <br /><small style={{ color: "var(--secondary)" }}>{ev.source} • {new Date(ev.createdAt).toLocaleDateString()}</small>
                        </td>
                        <td>{ev.category}</td>
                        <td className={ev.sentiment > 0 ? "positive" : ev.sentiment < 0 ? "negative" : ""}>
                          {ev.sentiment > 0 ? "+" : ""}{Number(ev.sentiment).toFixed(2)}
                        </td>
                        <td>{Number(ev.impact || 1.0).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
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

