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
import { riskApi } from "../services/api"
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

export function Overview({ portfolioId }: { portfolioId?: string | null }) {
  const [market, setMarket] = useState(58)
  const [credit, setCredit] = useState(42)
  const [liquidity, setLiquidity] = useState(24)
  const [horizon, setHorizon] = useState("12 months")
  const [selected, setSelected] = useState<number | null>(null)
  
  const [events, setEvents] = useState<any[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(2450)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [portfolios, fetchedEvents] = await Promise.all([
          riskApi.getPortfolios(),
          riskApi.getEvents(portfolioId || undefined)
        ])
        if (portfolios && portfolios.length > 0) {
          setPortfolioValue(portfolios[0].baselineValue || 2450)
        }
        setEvents(fetchedEvents)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const shift = (market + credit + liquidity - 124) / 6

  return (
    <div className="page">
      <PageHeading
        title="Portfolio Risk Overview"
        description="Understand current exposure, risk concentration, and the financial events most likely to affect the portfolio."
      />
      <Summary
        items={[
          {
            label: "Total portfolio exposure",
            value: `₹${portfolioValue.toLocaleString()} Cr`,
            detail: "Loans, bonds and derivatives",
          },
          {
            label: "Current risk level",
            value: `${Math.round(48 + shift / 2)}/100`,
            tone: "risk",
            detail: "Moderately elevated",
          },
          {
            label: "Overall sentiment",
            value: "-0.18",
            tone: "negative",
            detail: "Down 0.07 today",
          },
        ]}
      />
      <div className="workspace-grid">
        <div className="analysis-column">
          <RiskHistogram
            shift={shift}
            title="Portfolio Value at Risk"
            subtitle="Distribution of portfolio exposure across modeled default-risk ranges over the selected planning horizon."
            selected={selected ?? undefined}
            onSelect={setSelected}
          />
          <section className="data-section">
            <PanelTitle
              title="Significant financial events"
              subtitle="Latest events ranked by estimated portfolio impact"
            />
            <EventTable
              rows={events.slice(0, 5)}
              selected={selected}
              onSelect={setSelected}
            />
          </section>
        </div>
        <aside className="control-panel">
          <PanelTitle
            title="Risk parameters"
            subtitle="Adjust the current analytical view"
          />
          <div className="control-stack">
            <div className="control-group-label">Risk factor weights</div>
            <Slider
              label="Market risk weight"
              value={market}
              min={0}
              max={100}
              onChange={setMarket}
            />
            <Slider
              label="Credit risk weight"
              value={credit}
              min={0}
              max={100}
              onChange={setCredit}
            />
            <Slider
              label="Liquidity risk weight"
              value={liquidity}
              min={0}
              max={100}
              onChange={setLiquidity}
            />
            <div className="control-group-label">Analysis horizon</div>
            <label className="field-label">
              <span>Planning horizon</span>
              <select
                value={horizon}
                onChange={(event) => setHorizon(event.target.value)}
              >
                <option>3 months</option>
                <option>6 months</option>
                <option>12 months</option>
                <option>24 months</option>
              </select>
            </label>
          </div>
          <div className="context-note">
            <strong>Current interpretation</strong>
            <p>
              Risk is concentrated between 8% and 16% modeled default
              probability. Corporate credit remains the largest marginal
              contributor.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
