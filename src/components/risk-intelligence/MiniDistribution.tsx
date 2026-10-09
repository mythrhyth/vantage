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

export function MiniDistribution({
  values,
  labels,
  type = "bars",
}: {
  values: number[]
  labels: string[]
  type?: "bars" | "dots"
}) {
  const maxVal = useMemo(() => Math.max(...values, 1), [values]);

  return (
    <div className="mini-chart">
      <div className="mini-y-axis">
        <span>High</span>
        <span>Medium</span>
        <span>Low</span>
      </div>
      <div className={`mini-distribution ${type}`}>
        <div className="mini-grid-lines">
          <i />
          <i />
          <i />
        </div>
        {values.map((value, index) => {
          const heightPercent = value > 0 ? Math.max(8, Math.round((value / maxVal) * 85)) : 0;
          return (
            <div className="mini-bar-column" key={labels[index]}>
              <span className="mini-bar-area">
                <i style={{ height: `${heightPercent}%` }}>
                  <b className="tooltip">{value} modeled event{value === 1 ? '' : 's'}</b>
                </i>
              </span>
              <small>{labels[index]}</small>
            </div>
          );
        })}
      </div>
    </div>
  )
}
