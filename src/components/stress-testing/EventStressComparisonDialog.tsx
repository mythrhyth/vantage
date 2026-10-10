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

export function EventStressComparisonDialog({
  history,
  onClose,
}: {
  history: StressTestHistoryEntry[]
  onClose: () => void
}) {
  const available = history.slice(0, 4)
  const [selected, setSelected] = useState<number[]>(
    available.map((entry) => entry.runId),
  )
  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])
  const toggle = (runId: number) => {
    setSelected((current) =>
      current.includes(runId)
        ? current.length > 1
          ? current.filter((id) => id !== runId)
          : current
        : current.length < 4
          ? [...current, runId]
          : current,
    )
  }
  const rows = history
    .filter((entry) => selected.includes(entry.runId))
    .sort((a, b) => b.loss - a.loss)

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => input.target === input.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog event-stress-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-stress-compare-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Event stress-test comparison</span>
            <div className="dialog-title" id="event-stress-compare-title">
              Compare Stress Tests
            </div>
            <span className="dialog-meta">
              Compare up to four completed event-driven runs
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close event stress-test comparison"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <div className="event-history-choice-grid">
            {history.slice(0, 8).map((entry) => (
              <Button
                key={entry.runId}
                variant="text"
                className={selected.includes(entry.runId) ? "selected" : ""}
                ariaPressed={selected.includes(entry.runId)}
                onClick={() => toggle(entry.runId)}
              >
                {entry.event?.title || entry.scenario || "Manual Stress Test"}
              </Button>
            ))}
          </div>
          <section className="dialog-section comparison-table-section">
            <div className="dialog-section-title">
              Portfolio risk comparison
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event / Scenario</th>
                    <th>Scenario</th>
                    <th>Impact</th>
                    <th>Portfolio loss</th>
                    <th>Loss %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry, index) => {
                    const portBaseline = entry.baselineValue || 1000;
                    const lossPct = portBaseline > 0 ? (entry.loss / portBaseline) * 100 : 0;
                    return (
                      <tr
                        className={index === 0 && entry.loss > 0 ? "largest-loss-row" : ""}
                        key={entry.runId}
                      >
                        <td>
                          <strong>{entry.event?.title || entry.scenario || "Manual Stress Test"}</strong>
                          {index === 0 && entry.loss > 0 && <small>Greatest portfolio risk</small>}
                        </td>
                        <td>{entry.scenario || "Custom Stress"}</td>
                        <td>{entry.event?.impact != null ? Number(entry.event.impact).toFixed(1) : "N/A"}</td>
                        <td className={entry.loss > 0 ? "negative" : ""}>
                          {entry.loss > 0 ? `-₹${entry.loss.toFixed(1)} Cr` : `₹0.0 Cr`}
                        </td>
                        <td className={entry.loss > 0 ? "negative" : ""}>
                          {entry.loss > 0 ? `-${lossPct.toFixed(1)}%` : `0.0%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <span className="prototype-label">
              Evaluated using active portfolio exposures and canonical backend RiskEngineService.
            </span>
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
