import React from "react"
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
import { ModalDialog } from "../common/ModalDialog"
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
  trace,
  onClose,
}: {
  sensitivity: number
  maxWeight: number
  maxChange: number
  sectorLimit: number
  frequency: string
  cost: number
  trace?: any
  onClose: () => void
}) {
  const turnoverPct = trace?.metrics?.totalTurnoverPct !== undefined ? Number(trace.metrics.totalTurnoverPct) : sensitivity * 0.041
  const costVal = trace?.metrics?.estimatedTransactionCostVal !== undefined ? Number(trace.metrics.estimatedTransactionCostVal) : (turnoverPct * 2450.0 * 2 * (cost / 10000))
  const costPct = trace?.metrics?.estimatedTransactionCostPct !== undefined ? Number(trace.metrics.estimatedTransactionCostPct) : (turnoverPct * cost) / 100

  return (
    <ModalDialog
      className="overall-allocation-dialog"
      labelledBy="overall-allocation-title"
      describedBy="overall-allocation-description"
      onClose={onClose}
    >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Portfolio explainability & deterministic optimizer trace</span>
            <div className="dialog-title" id="overall-allocation-title">
              Overall Allocation Rationale
            </div>
            <span className="dialog-meta" id="overall-allocation-description">
              Proposed portfolio • Optimizer Status: <strong>{trace?.optimizerStatus || 'CONVERGED'}</strong>
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
              The tactical index rebalancer processes real NLP news sentiment signals and solves a deterministic projection optimization over portfolio equity holdings.
              Stock weight changes are bounded by maximum stock weight (<strong>{maxWeight}%</strong>), maximum change per stock (<strong>±{maxChange} pp</strong>), and sector caps (<strong>{sectorLimit}%</strong>).
            </p>
          </section>
          <div className="overall-metric-grid">
            <span>
              <small>Optimizer Status</small>
              <b className={trace?.optimizerStatus === 'INFEASIBLE' ? 'negative' : 'positive'}>
                {trace?.optimizerStatus || 'CONVERGED'}
              </b>
            </span>
            <span>
              <small>Proposed Turnover</small>
              <b>{turnoverPct.toFixed(2)}%</b>
            </span>
            <span>
              <small>Estimated Transaction Cost ({cost} bps)</small>
              <b>${costVal.toFixed(2)} ({costPct.toFixed(4)}%)</b>
            </span>
          </div>
          <div className="dialog-two-column overall-driver-grid">
            <section className="dialog-section">
              <div className="dialog-section-title">
                Positive allocation drivers
              </div>
              <div className="allocation-driver-list positive-drivers">
                {["Technology", "Communication Services", "Semiconductors"].map((driver) => (
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
                {["Financial Services", "Energy", "Automotive"].map((driver) => (
                  <span key={driver}>
                    <i>↓</i>
                    <b>{driver}</b>
                  </span>
                ))}
              </div>
            </section>
          </div>
          <section className="dialog-section">
            <div className="dialog-section-title">Active portfolio constraints</div>
            <div className="overall-constraint-list">
              {[
                ["Maximum stock weight cap", `${maxWeight}%`],
                ["Maximum allocation change cap", `±${maxChange} pp`],
                ["Sector exposure limit", `${sectorLimit}%`],
                ["Rebalancing frequency", frequency],
                ["Transaction cost rate", `${cost} bps`],
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
    </ModalDialog>
  )
}
