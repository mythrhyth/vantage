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

export function RiskHistogram({
  shift = 0,
  title = "Risk distribution",
  subtitle = "Portfolio exposure by modeled default probability",
  selected,
  onSelect,
}: {
  shift?: number
  title?: string
  subtitle?: string
  selected?: number
  onSelect?: (index: number) => void
}) {
  const base = [10, 24, 42, 67, 94, 112, 126, 117, 96, 68, 44, 25, 13]
  const values = base.map((value, index) =>
    Math.max(5, value + shift * ((index - 5) / 7)),
  )
  const max = Math.max(...values)
  return (
    <section className="chart-panel">
      <PanelTitle
        title={title}
        subtitle={subtitle}
        side={
          <div className="chart-key">
            <i />
            Modeled exposure
          </div>
        }
      />
      <div className="histogram">
        <div className="y-axis">
          <span>₹150 Cr</span>
          <span>₹100 Cr</span>
          <span>₹50 Cr</span>
          <span>₹0</span>
        </div>
        <div className="plot-grid">
          <i />
          <i />
          <i />
          <i />
          <div className="bars">
            {values.map((value, index) => (
              <button
                key={index}
                className={`histogram-bar ${
                  selected === index ? "selected" : ""
                }`}
                style={{ height: `${(value / max) * 86}%` }}
                onClick={() => onSelect?.(index)}
              >
                <span className="tooltip">
                  {index * 2}–{index * 2 + 2}% default risk
                  <br />
                  <b>₹{value.toFixed(0)} Cr exposure</b>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="x-axis">
          {values.map((_, index) => (
            <span key={index}>{index % 2 === 0 ? `${index * 2}%` : ""}</span>
          ))}
        </div>
        <div className="x-label">Default risk probability</div>
      </div>
    </section>
  )
}
