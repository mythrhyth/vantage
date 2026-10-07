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
        {values.map((value, index) => (
          <div className="mini-bar-column" key={labels[index]}>
            <span className="mini-bar-area">
              <i style={{ height: `${value}%` }}>
                <b className="tooltip">{value} modeled events</b>
              </i>
            </span>
            <small>{labels[index]}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
