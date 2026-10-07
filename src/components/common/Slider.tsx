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

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "%",
  onChange,
  baseline,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (value: number) => void
  baseline?: number
}) {
  const position = ((value - min) / (max - min)) * 100
  const basePosition =
    baseline === undefined ? null : ((baseline - min) / (max - min)) * 100
  return (
    <label className="slider-control">
      <span className="slider-heading">
        <span>{label}</span>
        <strong>
          {value > 0 && suffix !== "%" ? "+" : ""}
          {value}
          {suffix}
        </strong>
      </span>
      <span className="slider-track-wrap">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="slider-fill" style={{ width: `${position}%` }} />
        {basePosition !== null && (
          <i className="slider-baseline" style={{ left: `${basePosition}%` }} />
        )}
      </span>
      <span className="slider-scale">
        <span>
          {min}
          {suffix}
        </span>
        {baseline !== undefined && (
          <span>
            Baseline {baseline}
            {suffix}
          </span>
        )}
        <span>
          {max}
          {suffix}
        </span>
      </span>
    </label>
  )
}
