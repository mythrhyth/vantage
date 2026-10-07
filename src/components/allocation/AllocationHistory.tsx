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

export function AllocationHistory({ sensitivity }: { sensitivity: number }) {
  const offset = sensitivity / 20
  return (
    <section className="line-chart-panel">
      <PanelTitle
        title="Historical allocation trend"
        subtitle="Aggregate technology and financial sector weights · 12 months"
      />
      <div className="line-chart">
        <div className="line-grid">
          <i />
          <i />
          <i />
          <i />
        </div>
        <svg viewBox="0 0 800 160" preserveAspectRatio="none">
          <path
            className="line-primary"
            d={`M0 120 C100 ${110 - offset} 130 85 220 92 S350 55 430 70 S570 40 640 48 S730 28 800 ${34 - offset}`}
          />
          <path
            className="line-secondary"
            d="M0 55 C90 62 160 52 235 68 S390 88 470 82 S610 105 690 98 S760 110 800 103"
          />
        </svg>
        <div className="month-axis">
          {["Jul", "Sep", "Nov", "Jan", "Mar", "May", "Jun"].map((month) => (
            <span key={month}>{month}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
