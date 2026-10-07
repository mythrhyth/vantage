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

export function AllocationChart({
  proposed,
  assets,
  sensitivity,
}: {
  assets?: any[]
  proposed: boolean
  sensitivity: number
}) {
  const values = useMemo(() => {
    if (!assets) return []
    const raw = assets.map(
      (stock) => stock.current + ((stock.sentiment * sensitivity) / 100) * 1.25,
    )
    const total = raw.reduce((sum, value) => sum + value, 0)
    return raw.map((value) => (value / total) * 100)
  }, [sensitivity, assets])

  const maxWeightVal = useMemo(() => {
    if (!assets || assets.length === 0) return 100
    const maxCurr = Math.max(...assets.map((a) => Number(a.current) || 0))
    const maxProp = Math.max(...values.map((v) => Number(v) || 0))
    const highest = Math.max(maxCurr, maxProp)
    return highest > 0 ? highest : 100
  }, [assets, values])

  return (
    <section className="chart-panel allocation-chart">
      <PanelTitle
        title="Stock weight distribution"
        subtitle="Current and proposed index allocation"
        side={
          <div className="allocation-legend">
            <span>
              <i />
              Current
            </span>
            <span>
              <i />
              Proposed
            </span>
          </div>
        }
      />
      <div className="horizontal-chart">
        {(assets || []).map((stock, index) => {
          const currentPct = Math.min(100, Math.max(0, (stock.current / maxWeightVal) * 100))
          const proposedVal = values[index] ?? stock.current
          const proposedPct = Math.min(100, Math.max(0, (proposedVal / maxWeightVal) * 100))
          return (
            <div className="horizontal-row" key={stock.ticker}>
              <b>{stock.ticker}</b>
              <div className="horizontal-track">
                <span
                  className="current-bar"
                  style={{ width: `${currentPct}%` }}
                >
                  <i className="tooltip">{stock.current.toFixed(1)}%</i>
                </span>
                {proposed && (
                  <span
                    className="proposed-bar"
                    style={{ width: `${proposedPct}%` }}
                  >
                    <i className="tooltip">{proposedVal.toFixed(1)}%</i>
                  </span>
                )}
              </div>
              <strong>
                {(proposed ? proposedVal : stock.current).toFixed(1)}%
              </strong>
            </div>
          )
        })}
      </div>
    </section>
  )
}
