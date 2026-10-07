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

export function OverallAllocationDialog({
  sensitivity,
  maxWeight,
  maxChange,
  sectorLimit,
  frequency,
  cost,
  onClose,
}: {
  sensitivity: number
  maxWeight: number
  maxChange: number
  sectorLimit: number
  frequency: string
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

  const turnover = sensitivity * 0.041
  const estimatedCost = (turnover * cost) / 100

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => {
        if (input.target === input.currentTarget) onClose()
      }}
    >
      <section
        className="explainability-dialog overall-allocation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="overall-allocation-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Portfolio explainability</span>
            <div className="dialog-title" id="overall-allocation-title">
              Overall Allocation Rationale
            </div>
            <span className="dialog-meta">
              Proposed portfolio · Current parameter set
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close overall allocation explanation"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <section className="dialog-section allocation-primary-reason">
            <div className="dialog-section-title">
              Overall allocation rationale
            </div>
            <p>
              Positive aggregate sentiment is driving a modest increase in
              technology exposure while negative signals are reducing exposure
              to selected financial and energy positions.
            </p>
          </section>
          <div className="overall-metric-grid">
            <span>
              <small>Weighted sentiment</small>
              <b className="positive">+0.34</b>
            </span>
            <span>
              <small>Proposed turnover</small>
              <b>{turnover.toFixed(1)}%</b>
            </span>
            <span>
              <small>Estimated cost</small>
              <b>{estimatedCost.toFixed(2)}%</b>
            </span>
          </div>
          <div className="dialog-two-column overall-driver-grid">
            <section className="dialog-section">
              <div className="dialog-section-title">
                Positive allocation drivers
              </div>
              <div className="allocation-driver-list positive-drivers">
                {["Technology", "Semiconductors", "Software"].map((driver) => (
                  <span key={driver}>
                    <i>↑</i>
                    <b>{driver}</b>
                  </span>
                ))}
              </div>
            </section>
            <section className="dialog-section">
              <div className="dialog-section-title">
                Negative allocation drivers
              </div>
              <div className="allocation-driver-list negative-drivers">
                {["Financials", "Energy"].map((driver) => (
                  <span key={driver}>
                    <i>↓</i>
                    <b>{driver}</b>
                  </span>
                ))}
              </div>
            </section>
          </div>
          <section className="dialog-section">
            <div className="dialog-section-title">Key constraints</div>
            <div className="overall-constraint-list">
              {[
                ["Maximum stock weight", `${maxWeight}%`],
                ["Maximum allocation change", `${maxChange}%`],
                ["Sector exposure limit", `${sectorLimit}%`],
                ["Rebalancing frequency", frequency],
                ["Transaction cost", `${cost} bps`],
              ].map(([label, value]) => (
                <span key={label}>
                  <small>{label}</small>
                  <b>{value}</b>
                </span>
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
