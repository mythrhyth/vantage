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

export function ScenarioComparisonDialog({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<ScenarioName[]>([
    "Interest Rate Shock",
    "Equity Market Crash",
    "Credit Crisis",
    "Oil Shock",
  ])
  useEffect(() => {
    const closeOnEscape = (input: KeyboardEvent) => {
      if (input.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [onClose])

  const toggle = (name: ScenarioName) => {
    setSelected((current) => {
      if (current.includes(name)) {
        return current.length > 2
          ? current.filter((item) => item !== name)
          : current
      }
      return current.length < 4 ? [...current, name] : current
    })
  }
  const rows = selected
    .map((name) => ({ name, loss: calculateScenarioLoss(({} as any)) }))
    .sort((a, b) => b.loss - a.loss)

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(input) => input.target === input.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog scenario-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scenario-compare-title"
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Scenario comparison</span>
            <div className="dialog-title" id="scenario-compare-title">
              Compare scenarios
            </div>
            <span className="dialog-meta">
              Select two to four prototype scenarios
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close scenario comparison"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
        <div className="explainability-body">
          <div className="scenario-choice-grid">
            {([] as ScenarioName[]).map((name) => (
              <Button
                key={name}
                variant="text"
                className={selected.includes(name) ? "selected" : ""}
                ariaPressed={selected.includes(name)}
                onClick={() => toggle(name)}
              >
                {name}
              </Button>
            ))}
          </div>
          <section className="dialog-section comparison-table-section">
            <div className="dialog-section-title">Modeled portfolio impact</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Scenario</th>
                    <th>Stressed value</th>
                    <th>Loss</th>
                    <th>Loss %</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      className={index === 0 ? "largest-loss-row" : ""}
                      key={row.name}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        {index === 0 && <small>Largest loss</small>}
                      </td>
                      <td>₹{(2450 - row.loss).toFixed(1)} Cr</td>
                      <td className="negative">-₹{row.loss.toFixed(1)} Cr</td>
                      <td className="negative">
                        -{(row.loss / 24.5).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <span className="prototype-label">
              Comparison values are prototype model outputs using the configured
              preset assumptions.
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
