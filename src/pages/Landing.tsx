import React, { useState, useEffect, useMemo } from "react"
import { Page, IconName, Portfolio, RiskEvent, StressTestRun } from "../types"
import { Icon } from "../components/common/Icon"
import { Button } from "../components/common/Button"
import { PanelTitle } from "../components/common/PanelTitle"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"
import { riskApi } from "../services/api"

export function Landing({
  navigate,
  portfolioId,
  onRunStressTest,
}: {
  navigate: (page: Page) => void
  portfolioId?: string | null
  onRunStressTest?: (event: any) => void
}) {
  const [events, setEvents] = useState<RiskEvent[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null)
  const [latestRun, setLatestRun] = useState<StressTestRun | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<RiskEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [eventsLoaded, setEventsLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    setEvents([])
    setEventsLoaded(false)
    setPortfolioValue(null)
    setLatestRun(null)

    Promise.allSettled([
      riskApi.getEvents(portfolioId || undefined),
      riskApi.getPortfolios(),
      riskApi.getStressHistory(),
    ]).then(([eventsResult, portfoliosResult, historyResult]) => {
      if (!active) return
      const errors: string[] = []

      if (eventsResult.status === "fulfilled") {
        setEvents(eventsResult.value)
        setEventsLoaded(true)
      } else {
        errors.push(`events: ${eventsResult.reason instanceof Error ? eventsResult.reason.message : String(eventsResult.reason)}`)
      }

      if (portfoliosResult.status === "fulfilled") {
        const portfolios: Portfolio[] = portfoliosResult.value
        const activePortfolio = portfolioId
          ? portfolios.find(portfolio => portfolio.id === portfolioId)
          : portfolios[0]
        if (activePortfolio && Number.isFinite(Number(activePortfolio.baselineValue))) {
          setPortfolioValue(Number(activePortfolio.baselineValue))
        } else if (portfolios.length > 0) {
          errors.push("the selected portfolio could not be found")
        }
      } else {
        errors.push(`portfolio: ${portfoliosResult.reason instanceof Error ? portfoliosResult.reason.message : String(portfoliosResult.reason)}`)
      }

      if (historyResult.status === "fulfilled") {
        const portfolioHistory = portfolioId
          ? historyResult.value.filter(run => run.portfolio_id === portfolioId)
          : historyResult.value
        setLatestRun(portfolioHistory[0] ?? null)
      } else {
        errors.push(`stress history: ${historyResult.reason instanceof Error ? historyResult.reason.message : String(historyResult.reason)}`)
      }

      setLoadError(errors.length > 0 ? errors.join("; ") : null)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [portfolioId])

  const avgSentiment = useMemo<number | null>(() => {
    const sentiments = events
      .map(event => Number(event.sentiment))
      .filter(Number.isFinite)
    if (sentiments.length === 0) return null
    return sentiments.reduce((sum, sentiment) => sum + sentiment, 0) / sentiments.length
  }, [events])

  const riskDistribution = useMemo<number[] | null>(() => {
    const impacts = events
      .map(event => Number(event.impact_score ?? event.impact))
      .filter(Number.isFinite)
    if (impacts.length === 0) return null

    const buckets = Array(9).fill(0) as number[]
    events.forEach((ev) => {
      const imp = Number(ev.impact_score ?? ev.impact)
      if (!Number.isFinite(imp)) return
      const bucketIdx = Math.min(8, Math.max(0, Math.floor(imp)))
      buckets[bucketIdx] += 1
    })
    const maxBucket = Math.max(...buckets)
    return maxBucket > 0 ? buckets.map(count => Math.round((count / maxBucket) * 100)) : null
  }, [events])

  const latestRiskScore = Number(latestRun?.riskScore ?? latestRun?.attributionResult?.risk_score)
  const hasLatestRiskScore = latestRun !== null && Number.isFinite(latestRiskScore)

  const riskLevelLabel = hasLatestRiskScore
    ? latestRiskScore >= 70
      ? "High"
      : latestRiskScore >= 45
        ? "Moderate"
        : "Low"
    : "—"

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
            <span>Event impact distribution</span>
            <strong>{riskLevelLabel}</strong>
          </div>
          {riskDistribution ? (
            <div className="landing-bars" aria-label="Distribution of actual event impact scores">
              {riskDistribution.map((value, index) => (
                <i key={index} style={{ height: `${value}%` }} />
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ flex: 1, minHeight: 0, padding: "16px" }}>
              <strong>{loading ? "Loading live risk data..." : "No risk distribution available"}</strong>
              <span>Impact distribution appears when risk events are available.</span>
            </div>
          )}
          <div className="landing-axis">
            <span>Low impact</span>
            <span>Moderate impact</span>
            <span>High impact</span>
          </div>
        </div>
      </section>
      <section className="landing-summary">
        <span>
          <small>Portfolio exposure</small>
          <strong>{portfolioValue === null ? "—" : `₹${portfolioValue.toLocaleString()} Cr`}</strong>
        </span>
        <span>
          <small>Risk score</small>
          <strong>{hasLatestRiskScore ? `${Math.round(latestRiskScore)} / 100` : "—"}</strong>
        </span>
        <span>
          <small>Market sentiment</small>
          <strong className={avgSentiment !== null && avgSentiment < 0 ? "negative" : ""}>
            {avgSentiment === null ? "—" : `${avgSentiment > 0 ? "+" : ""}${avgSentiment.toFixed(2)}`}
          </strong>
        </span>
        <span>
          <small>Significant events</small>
          <strong>{eventsLoaded ? events.length : "—"}</strong>
        </span>
      </section>
      {loadError && (
        <div role="alert" className="empty-state" style={{ minHeight: 0, padding: "14px 20px", border: "1px solid var(--border)" }}>
          <strong>Some live landing-page data could not be loaded.</strong>
          <span>{loadError}</span>
        </div>
      )}
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
        {loading ? (
          <div className="empty-state">
            <strong>Loading live risk signals...</strong>
          </div>
        ) : !eventsLoaded ? (
          <div role="alert" className="empty-state">
            <strong>Unable to load risk signals</strong>
            <span>Check the risk API connection and try again.</span>
          </div>
        ) : events.length > 0 ? (
          <EventTable
            rows={events.slice(0, 3)}
            onSelect={(index) => setSelectedEvent(events[index])}
          />
        ) : (
          <div className="empty-state">
            <strong>No risk signals available</strong>
            <span>Run ingestion or check that the risk API is connected to view current events.</span>
          </div>
        )}
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
