import React, { useState, useEffect, useMemo } from "react"
import { Page, IconName } from "../types"
import { Icon } from "../components/common/Icon"
import { Button } from "../components/common/Button"
import { PanelTitle } from "../components/common/PanelTitle"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"

export function Landing({
  navigate,
  portfolioId,
  onRunStressTest,
}: {
  navigate: (page: Page) => void
  portfolioId?: string | null
  onRunStressTest?: (event: any) => void
}) {
  const [events, setEvents] = useState<any[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(2450)
  const [latestRun, setLatestRun] = useState<any | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)

  useEffect(() => {
    import("../services/api").then(({ riskApi }) => {
      Promise.all([
        riskApi.getEvents(portfolioId || undefined),
        riskApi.getPortfolios(),
        riskApi.getStressHistory().catch(() => []),
      ])
        .then(([data, portfolios, history]) => {
          if (Array.isArray(data)) setEvents(data)
          if (Array.isArray(portfolios) && portfolios.length > 0) {
            const activePort = portfolioId
              ? portfolios.find((p: any) => p.id === portfolioId) || portfolios[0]
              : portfolios[0]
            if (activePort && activePort.baselineValue) {
              setPortfolioValue(Number(activePort.baselineValue))
            }
          }
          if (Array.isArray(history) && history.length > 0) {
            // Find latest run with valid non-zero score if available, or first run
            const activeRun = history.find((r: any) => Number(r.riskScore ?? r.risk_score) > 0) || history[0]
            setLatestRun(activeRun)
          }
        })
        .catch(console.error)
    })
  }, [portfolioId])

  const avgSentiment = useMemo(() => {
    if (!events || events.length === 0) return "-0.18"
    const sum = events.reduce(
      (acc, e) =>
        acc +
        (typeof e.sentiment === "number"
          ? e.sentiment
          : parseFloat(e.sentiment) || 0),
      0,
    )
    return (sum / events.length).toFixed(2)
  }, [events])

  const realDistribution = useMemo(() => {
    if (!events || events.length === 0) {
      return [18, 31, 49, 74, 91, 78, 55, 34, 19]
    }
    const buckets = Array(9).fill(0)
    events.forEach((ev) => {
      const imp = typeof ev.impact === "number" ? ev.impact : parseFloat(ev.impact) || 5
      const bucketIdx = Math.min(8, Math.max(0, Math.floor(((imp - 1) / 9) * 9)))
      buckets[bucketIdx] += 1
    })
    const maxBucket = Math.max(...buckets, 1)
    return buckets.map((count) => Math.max(12, Math.round((count / maxBucket) * 92)))
  }, [events])

  const latestRiskScore = useMemo(() => {
    if (latestRun && typeof (latestRun.riskScore ?? latestRun.risk_score) === "number" && Number(latestRun.riskScore ?? latestRun.risk_score) > 0) {
      return Math.round(Number(latestRun.riskScore ?? latestRun.risk_score))
    }
    if (events && events.length > 0) {
      const avgImp =
        events.reduce((sum, e) => sum + (Number(e.impact) || 5), 0) / events.length
      return Math.min(100, Math.max(10, Math.round(avgImp * 9.5)))
    }
    return 68
  }, [latestRun, events])

  const riskLevelLabel = useMemo(() => {
    if (latestRiskScore >= 70) return "High"
    if (latestRiskScore >= 45) return "Moderate"
    return "Low"
  }, [latestRiskScore])

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
            <strong>{riskLevelLabel}</strong>
          </div>
          <div className="landing-bars">
            {realDistribution.map((value, index) => (
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
          <strong>₹{portfolioValue.toLocaleString()} Cr</strong>
        </span>
        <span>
          <small>Risk score</small>
          <strong>{latestRiskScore} / 100</strong>
        </span>
        <span>
          <small>Market sentiment</small>
          <strong className={Number(avgSentiment) < 0 ? "negative" : ""}>
            {avgSentiment > "0" && !avgSentiment.startsWith("+") ? `+${avgSentiment}` : avgSentiment}
          </strong>
        </span>
        <span>
          <small>Significant events</small>
          <strong>{events.length}</strong>
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
          onSelect={(index) => setSelectedEvent(events[index])}
        />
      </section>
      {selectedEvent && (
        <EventExplainabilityDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onRunStressTest={onRunStressTest}
        />
      )}
    </div>
  )
}
