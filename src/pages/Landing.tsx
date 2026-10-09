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

export function Landing({ navigate }: { navigate: (page: Page) => void }) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    import("../services/api").then(({ riskApi }) => {
      riskApi.getEvents().then(data => setEvents(data)).catch(console.error);
    })
  }, []);

  return (
    <div className="landing-page">
      <section className="landing-intro">
        <div>
          <span className="landing-kicker">FINANCIAL RISK ANALYTICS</span>
          <div className="landing-title">A clearer view of portfolio risk.</div>
          <p>
            Evaluate market signals, allocation changes, and banking portfolio
            resilience from one focused analytical workspace.
          </p>
          <Button onClick={() => navigate("Overview")}>
            Open risk overview
          </Button>
        </div>
        <div className="landing-visual">
          <div className="landing-chart-head">
            <span>Portfolio risk distribution</span>
            <strong>Moderate</strong>
          </div>
          <div className="landing-bars">
            {[18, 31, 49, 74, 91, 78, 55, 34, 19].map((value, index) => (
              <i key={index} style={{ height: `${value}%` }} />
            ))}
          </div>
          <div className="landing-axis">
            <span>Low risk</span>
            <span>Default probability</span>
            <span>High risk</span>
          </div>
        </div>
      </section>
      <section className="landing-summary">
        <span>
          <small>Portfolio exposure</small>
          <strong>₹2,450 Cr</strong>
        </span>
        <span>
          <small>Risk score</small>
          <strong>68 / 100</strong>
        </span>
        <span>
          <small>Market sentiment</small>
          <strong className="negative">-0.18</strong>
        </span>
        <span>
          <small>Significant events</small>
          <strong>12</strong>
        </span>
      </section>
      <section className="landing-tools">
        <div className="landing-section-title">
          <strong>Analysis workspaces</strong>
          <span>Select an area to begin</span>
        </div>
        <div className="tool-grid">
          {[
            {
              page: "Risk Intelligence" as Page,
              icon: "intelligence" as IconName,
              title: "Risk intelligence",
              copy: "Review classified financial events, sentiment, and estimated impact.",
            },
            {
              page: "Index Allocation" as Page,
              icon: "allocation" as IconName,
              title: "Index allocation",
              copy: "Assess sentiment-driven weight changes under defined constraints.",
            },
            {
              page: "Portfolio Stress Testing" as Page,
              icon: "stress" as IconName,
              title: "Portfolio stress testing",
              copy: "Model banking exposure across market and macroeconomic shocks.",
            },
            {
              page: "Scenarios" as Page,
              icon: "scenario" as IconName,
              title: "Scenario analysis",
              copy: "Compare portfolio outcomes and understand loss attribution.",
            },
          ].map((tool) => (
            <button
              className="tool-link"
              key={tool.title}
              onClick={() => navigate(tool.page)}
            >
              <span className="tool-icon">
                <Icon name={tool.icon} />
              </span>
              <span>
                <b>{tool.title}</b>
                <small>{tool.copy}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="landing-events">
        <PanelTitle
          title="Latest risk signals"
          subtitle="Recent events with the highest estimated portfolio impact"
          side={
            <button
              className="inline-link"
              onClick={() => navigate("Risk Intelligence")}
            >
              View all
            </button>
          }
        />
        <EventTable
          rows={events.slice(0, 3)}
          onSelect={() => navigate("Risk Intelligence")}
        />
      </section>
    </div>
  )
}
