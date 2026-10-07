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

export function VantageLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`vantage-logo ${compact ? "compact" : ""}`}>
      <svg
        className="vantage-symbol"
        viewBox="0 0 32 32"
        role="img"
        aria-label="VANTAGE"
      >
        <path className="vantage-mark-primary" d="M3 5h7.2L16 20.2 12.3 28Z" />
        <path
          className="vantage-mark-secondary"
          d="M22.1 5H29L18.2 28h-5.9l3.7-7.8Z"
        />
      </svg>
      <span className="vantage-wordmark">
        <b>VANT</b>
        <b>AGE</b>
      </span>
    </span>
  )
}
