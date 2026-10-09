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

export function PageHeading({
  title,
  description,
  children
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div className="page-heading-main">
        <div>{title}</div>
        <p>{description}</p>
      </div>
      {children && <div className="page-heading-side">{children}</div>}
    </div>
  )
}
