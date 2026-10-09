import React, { useState, useEffect, useMemo } from "react"
import {
  Page,
  IconName,
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "../types"

import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
  generateEventStressParameters,
  calculateScenarioLoss,
} from "../utils"
import { Icon } from "../components/common/Icon"
import { VantageLogo } from "../components/common/VantageLogo"
import { Button } from "../components/common/Button"
import { Slider } from "../components/common/Slider"
import { Summary } from "../components/common/Summary"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { SettingsPanel } from "../components/common/SettingsPanel"
import { RiskHistogram } from "../components/risk-intelligence/RiskHistogram"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"
import { MiniDistribution } from "../components/risk-intelligence/MiniDistribution"
import { AllocationChart } from "../components/allocation/AllocationChart"
import { AllocationHistory } from "../components/allocation/AllocationHistory"
import { AllocationExplanationDialog } from "../components/allocation/AllocationExplanationDialog"
import { OverallAllocationDialog } from "../components/allocation/OverallAllocationDialog"
import { AssetLossDialog } from "../components/stress-testing/AssetLossDialog"
import { WhyLossDialog } from "../components/stress-testing/WhyLossDialog"
import { EventStressComparisonDialog } from "../components/stress-testing/EventStressComparisonDialog"
import { ScenarioComparisonDialog } from "../components/scenario-analysis/ScenarioComparisonDialog"

export function PortfolioStressTesting({
  portfolioId,
  triggerEvent,
  openScenario,
}: {
  portfolioId: string | null
  triggerEvent: any | null
  openScenario: () => void
}) {
  const defaultValues = { sp: 100, emerging: 100, technology: 100, oil: 100, gold: 100, dollar: 100, rates: 100, inflation: 100 };
  const [values, setValues] = useState(defaultValues)
  const stress = Object.values(values).reduce(
    (sum, value) => sum + Math.abs(value - 100),
    0,
  )
  const [backendResult, setBackendResult] = useState<any>(null)
  const [portfolioMeta, setPortfolioMeta] = useState<any>(null)

  useEffect(() => {
    if (portfolioId) {
      import("../services/api").then(({ riskApi }) => {
        riskApi.getPortfolio(portfolioId).then(p => {
          if (p) setPortfolioMeta(p)
        }).catch(console.error)
      })
    }
  }, [portfolioId])

  const directional =
    (100 - values.sp) * 0.2 +
    (100 - values.emerging) * 0.12 +
    (100 - values.technology) * 0.16 +
    Math.abs(values.rates - 100) * 0.18 +
    Math.abs(values.inflation - 100) * 0.12 +
    Math.abs(values.oil - 100) * 0.08 -
    (values.gold - 100) * 0.025 -
    (values.dollar - 100) * 0.02
  const fallbackLoss = Math.max(0, 18.2 + directional)
  
  const loss = backendResult?.absolute_loss ?? fallbackLoss
  const baseline = backendResult?.baseline_value ?? (portfolioMeta?.baseline_value ? Number(portfolioMeta.baseline_value) : 2450)
  const stressed = backendResult?.stressed_value ?? (baseline - fallbackLoss)
  
  const loansExp = portfolioMeta?.exposures?.loans ?? 1360
  const bondsExp = portfolioMeta?.exposures?.bonds ?? 800
  const derivativesExp = portfolioMeta?.exposures?.derivatives ?? 290
  const equityExp = portfolioMeta?.exposures?.equity ?? 0

  const totalExposures = loansExp + bondsExp + derivativesExp + equityExp
  const loansPct = totalExposures > 0 ? (loansExp / totalExposures) * 100 : 0
  const bondsPct = totalExposures > 0 ? (bondsExp / totalExposures) * 100 : 0
  const derivativesPct = totalExposures > 0 ? (derivativesExp / totalExposures) * 100 : 0
  const equityPct = totalExposures > 0 ? (equityExp / totalExposures) * 100 : 0

  const update = (key: keyof typeof values, value: number) =>
    setValues((current) => ({ ...current, [key]: value }))
  return (
    <div className="page">
      <PageHeading
        title="Portfolio Stress Testing"
        description="Estimate potential banking portfolio losses under changes in market, rate, commodity, and inflation variables."
      />
      {triggerEvent && (
        <section className="stress-trigger-bridge">
          <span>
            <small>Risk Intelligence trigger</small>
            <b>{triggerEvent.title}</b>
          </span>
          <i>→</i>
          <span>
            <small>Mapped scenario</small>
            <b>{mappedScenarioForEvent(triggerEvent.category)}</b>
          </span>
          <Button variant="text" onClick={openScenario}>
            Open Scenario Analysis
          </Button>
        </section>
      )}
      <Summary
        items={[
          {
            label: "Portfolio exposure",
            value: `₹${baseline.toFixed(1)} Cr`,
            detail: portfolioMeta?.name || "Configured Portfolio",
          },
          { label: "Loans", value: `₹${loansExp.toFixed(1)} Cr`, detail: `${loansPct.toFixed(1)}% of exposure` },
          { label: "Bonds", value: `₹${bondsExp.toFixed(1)} Cr`, detail: `${bondsPct.toFixed(1)}% of exposure` },
          {
            label: "Derivatives",
            value: `₹${derivativesExp.toFixed(1)} Cr`,
            detail: `${derivativesPct.toFixed(1)}% of exposure`,
          },
        ]}
      />
      <div className="workspace-grid stress-layout">
        <div className="analysis-column">
          <RiskHistogram
            shift={stress / 10}
            title="Portfolio Value at Risk"
            subtitle="Distribution of potential banking portfolio losses over a 12-month planning horizon."
          />
          <div className="result-strip">
            <span>
              <small>Baseline portfolio value</small>
              <strong>₹{baseline.toFixed(1)} Cr</strong>
            </span>
            <span>
              <small>Stressed portfolio value</small>
              <strong>₹{stressed.toFixed(1)} Cr</strong>
            </span>
            <span>
              <small>Absolute change</small>
              <strong className="negative">-₹{loss.toFixed(1)} Cr</strong>
            </span>
            <span>
              <small>Percentage change</small>
              <strong className="negative">-{((loss / baseline) * 100).toFixed(2)}%</strong>
            </span>
          </div>
          <section className="exposure-analysis">
            <PanelTitle
              title="Banking exposure analysis"
              subtitle="Estimated contribution to stressed loss"
            />
            <div className="stacked-exposure">
              {loansPct > 0 && (
                <div style={{ width: `${loansPct.toFixed(1)}%` }}>
                  <span>Loans</span>
                  <b>₹{(loss * (loansPct / 100)).toFixed(1)} Cr</b>
                </div>
              )}
              {bondsPct > 0 && (
                <div style={{ width: `${bondsPct.toFixed(1)}%` }}>
                  <span>Bonds</span>
                  <b>₹{(loss * (bondsPct / 100)).toFixed(1)} Cr</b>
                </div>
              )}
              {derivativesPct > 0 && (
                <div style={{ width: `${derivativesPct.toFixed(1)}%` }}>
                  <span>Derivatives</span>
                  <b>₹{(loss * (derivativesPct / 100)).toFixed(1)} Cr</b>
                </div>
              )}
              {equityPct > 0 && (
                <div style={{ width: `${equityPct.toFixed(1)}%` }}>
                  <span>Equity</span>
                  <b>₹{(loss * (equityPct / 100)).toFixed(1)} Cr</b>
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="control-panel stress-controls">
          <PanelTitle
            title="Adjust stress parameters"
            subtitle="100% represents the baseline value"
          />
          <div className="control-stack compact">
            <div className="control-group-label">Market variables</div>
            <Slider
              label="S&P 500"
              value={values.sp}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("sp", value)}
            />
            <Slider
              label="Emerging Markets"
              value={values.emerging}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("emerging", value)}
            />
            <Slider
              label="Technology"
              value={values.technology}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("technology", value)}
            />
            <Slider
              label="Oil"
              value={values.oil}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("oil", value)}
            />
            <Slider
              label="Gold"
              value={values.gold}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("gold", value)}
            />
            <Slider
              label="US Dollar"
              value={values.dollar}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("dollar", value)}
            />
            <div className="control-group-label">Macroeconomic variables</div>
            <Slider
              label="Interest Rates"
              value={values.rates}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("rates", value)}
            />
            <Slider
              label="Inflation"
              value={values.inflation}
              min={50}
              max={150}
              baseline={100}
              onChange={(value) => update("inflation", value)}
            />
          </div>
          <Button
            onClick={() => {
              if (portfolioId) {
                import("../services/api").then(({ riskApi }) => {
                  riskApi.runStressTest(portfolioId, values, undefined, triggerEvent?.id)
                    .then(res => setBackendResult(res))
                    .catch(console.error)
                })
              }
            }}
          >
            Run Stress Test
          </Button>
          <Button
            variant="text"
            icon="reset"
            onClick={() => {
              setValues(defaultValues)
              setBackendResult(null)
            }}
          >
            Reset controls
          </Button>
        </aside>
      </div>
    </div>
  )
}
