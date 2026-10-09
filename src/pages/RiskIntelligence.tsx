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

export function RiskIntelligence({
  runStressTest,
  portfolioId
}: {
  runStressTest: (event: any) => void;
  portfolioId: string | null;
}) {
  const [category, setCategory] = useState("All categories")
  const [sourceFilter, setSourceFilter] = useState("All")
  const [freshnessFilter, setFreshnessFilter] = useState("All")
  const [sentiment, setSentiment] = useState(100)
  const [impact, setImpact] = useState(0)
  const [horizon, setHorizon] = useState("All horizons")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [explainedEvent, setExplainedEvent] = useState<any | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ingestFeedback, setIngestFeedback] = useState<string | null>(null)
  const [ingesting, setIngesting] = useState(false)

  useEffect(() => {
    import("../services/api").then(({ riskApi }) => {
      riskApi.getSources().then(srcs => {
        const names = srcs.map(s => s.name);
        setAvailableSources(["All", ...names]);
      }).catch(console.error);
    });
  }, []);

  const loadEvents = () => {
    import("../services/api").then(({ riskApi }) => {
      setLoading(true)
      riskApi.getEvents(portfolioId || undefined, {
        category,
        horizon,
        source: sourceFilter !== "All" ? sourceFilter : undefined,
        freshness: freshnessFilter !== "All" ? freshnessFilter : undefined,
        impact: impact > 0 ? impact : undefined,
        sentiment: sentiment < 100 ? (sentiment / 100) : undefined
      })
        .then(data => {
          setEvents(data)
          setError(null)
          if (data.length > 0 && !selectedId) {
            setSelectedId(data[0].id)
          }
        })
        .catch(e => setError(e.message || "Unable to load risk events"))
        .finally(() => setLoading(false))
    });
  };

  const handleIngest = () => {
    setIngesting(true);
    setIngestFeedback(null);
    import("../services/api").then(({ riskApi }) => {
      riskApi.runIngestion().then(res => {
        const addedCount = res.stats?.newArticlesIngested ?? 0;
        setIngestFeedback(res.message || `Ingestion complete (${addedCount} new articles).`);
        setTimeout(() => setIngestFeedback(null), 5000);
        loadEvents();
      }).catch(e => {
        console.error('Ingestion failed:', e);
        setError('Ingestion failed: ' + e.message);
      }).finally(() => {
        setIngesting(false);
      });
    });
  };

  useEffect(() => {
    loadEvents();
  }, [portfolioId, category, horizon, sourceFilter, freshnessFilter, impact, sentiment]);

  const latestTimestamp = useMemo(() => {
    if (events.length === 0) return null;
    return events[0].publishedAt || events[0].createdAt || events[0].created_at || null;
  }, [events]);

  const relativeTimeLabel = useMemo(() => {
    if (!latestTimestamp) return "Updated just now";
    const date = new Date(latestTimestamp);
    if (isNaN(date.getTime())) return "Updated recently";
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Updated just now";
    if (diffMins === 1) return "Updated 1 minute ago";
    if (diffMins < 60) return `Updated ${diffMins} minutes ago`;
    if (diffHours === 1) return "Updated 1 hour ago";
    if (diffHours < 24) return `Updated ${diffHours} hours ago`;
    if (diffDays === 1) return "Updated yesterday";
    return `Updated ${diffDays} days ago`;
  }, [latestTimestamp]);

  const filtered = events.filter(
    (item) =>
      item.impact >= impact &&
      Math.abs(item.sentiment * 100) <= sentiment
  )

  const event = selectedId ? (filtered.find(e => e.id === selectedId) || null) : null

  if (loading) {
    return (
      <div className="page intelligence-page">
        <PageHeading title="Risk Intelligence" description="Loading risk intelligence..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="page intelligence-page">
        <PageHeading title="Risk Intelligence" description="Unable to load risk events" />
        <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center' }}>
          <strong>Error loading events: {error}</strong>
          <p style={{ marginTop: '8px' }}>Please check your network connection or backend services.</p>
          <Button variant="primary" style={{ marginTop: '16px' }} onClick={loadEvents}>
            Retry Loading
          </Button>
        </div>
      </div>
    )
  }


  // Calculate dynamic distributions
  const sentimentCounts = [0, 0, 0, 0, 0];
  const impactCounts = [0, 0, 0, 0, 0];
  filtered.forEach(item => {
    const s = item.sentiment;
    if (s < -0.6) sentimentCounts[0]++;
    else if (s < -0.3) sentimentCounts[1]++;
    else if (s < 0.3) sentimentCounts[2]++;
    else if (s <= 0.6) sentimentCounts[3]++;
    else sentimentCounts[4]++;

    const i = item.impact;
    if (i <= 2) impactCounts[0]++;
    else if (i <= 4) impactCounts[1]++;
    else if (i <= 6) impactCounts[2]++;
    else if (i <= 8) impactCounts[3]++;
    else impactCounts[4]++;
  });

  return (
    <div className="page intelligence-page">
      <PageHeading
        title="Risk Intelligence"
        description="Review classified financial events and understand their sentiment, expected impact, and affected entities."
      >
        <Button 
           variant="primary" 
           onClick={handleIngest} 
           disabled={ingesting}
        >
           {ingesting ? "Ingesting live news..." : "Ingest Live Events"}
        </Button>
      </PageHeading>
      {ingestFeedback && (
        <div className="ingest-feedback-banner" style={{ padding: '10px 16px', marginBottom: '14px', borderRadius: '6px', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '11px', border: '1px solid var(--border)' }}>
          {ingestFeedback}
        </div>
      )}
      <Summary
        items={[
          {
            label: "Events in view",
            value: String(filtered.length),
            detail: "Filtered structured events",
          },
          {
            label: "Average impact",
            value: filtered.length
              ? `${(filtered.reduce((sum, item) => sum + item.impact, 0) / filtered.length).toFixed(1)} / 10`
              : "—",
            detail: "Across current selection",
          },
          {
            label: "Directional sentiment",
            value: filtered.length
              ? (
                  filtered.reduce((sum, item) => sum + item.sentiment, 0) /
                  filtered.length
                ).toFixed(2)
              : "—",
            tone: "negative",
            detail: "Weighted event signal",
          },
          {
            label: "High-impact events",
            value: String(filtered.filter((item) => item.impact >= 7).length),
            tone: "risk",
            detail: "Impact score of 7 or higher",
          },
        ]}
      />
      <div className="workspace-grid intelligence-grid">
        <div className="analysis-column">
          <section className="intelligence-charts">
            <div>
              <PanelTitle
                title="Sentiment distribution"
                subtitle="Events by directional score"
              />
              <MiniDistribution
                values={sentimentCounts}
                labels={["<-0.6", "-0.3", "Neutral", "+0.3", ">+0.6"]}
              />
            </div>
            <div>
              <PanelTitle
                title="Impact profile"
                subtitle="Events by estimated impact"
              />
              <MiniDistribution
                values={impactCounts}
                labels={["0–2", "2–4", "4–6", "6–8", "8–10"]}
              />
            </div>
          </section>
          <section className="data-section intelligence-table">
            <PanelTitle
              title="Event analysis"
              subtitle={`${filtered.length} structured financial events in the current view`}
              side={<span className="updated">{relativeTimeLabel}</span>}
            />
            {filtered.length ? (
              <EventTable
                rows={filtered}
                selected={filtered.findIndex(e => e.id === selectedId)}
                showStressAction
                onSelect={(index) => {
                  setSelectedId(filtered[index].id)
                  import("../services/api").then(({ riskApi }) => {
                    riskApi.getEvent(filtered[index].id).then(e => setExplainedEvent(e))
                  })
                }}
              />
            ) : (
              <div className="empty-state">
                <strong>No relevant risk events found for this portfolio.</strong>
                <span>Adjust the filters or run an ingestion cycle to load new events.</span>
              </div>
            )}
          </section>
        </div>
        <aside className="control-panel intelligence-controls">
          <PanelTitle
            title="Filter events"
            subtitle="Refine the event analysis"
          />
          <div className="control-stack">
            <div className="control-group-label">Source & Freshness</div>
            
            <label className="field-label">
              <span>Trusted Source</span>
              <select
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setSelectedId(null);
                }}
              >
                {availableSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              <span>Freshness Window</span>
              <select
                value={freshnessFilter}
                onChange={(e) => {
                  setFreshnessFilter(e.target.value);
                  setSelectedId(null);
                }}
              >
                <option value="All">All time</option>
                <option value="1h">Last 1 hour</option>
                <option value="6h">Last 6 hours</option>
                <option value="24h">Last 24 hours</option>
                <option value="3d">Last 3 days</option>
                <option value="7d">Last 7 days</option>
              </select>
            </label>

            <div className="control-group-label" style={{ marginTop: '12px' }}>Event characteristics</div>
            <label className="field-label">
              <span>Event category</span>
              <select
                value={category}
                onChange={(input) => {
                  setCategory(input.target.value)
                  setSelectedId(null)
                }}
              >
                <option>All categories</option>
                <option>Monetary policy</option>
                <option>Credit</option>
                <option>Commodities</option>
                <option>Earnings</option>
                <option>Sector outlook</option>
                <option>Geopolitical</option>
                <option>Regulatory</option>
                <option>Macroeconomic</option>
              </select>
            </label>
            <Slider
              label="Sentiment range"
              value={sentiment}
              min={10}
              max={100}
              suffix="%"
              onChange={(value) => {
                setSentiment(value)
                setSelectedId(null)
              }}
            />
            <Slider
              label="Minimum impact"
              value={impact}
              min={0}
              max={10}
              step={0.5}
              suffix=""
              onChange={(value) => {
                setImpact(value)
                setSelectedId(null)
              }}
            />
            <label className="field-label">
              <span>Time horizon</span>
              <select
                value={horizon}
                onChange={(input) => {
                  setHorizon(input.target.value)
                  setSelectedId(null)
                }}
              >
                <option value="All horizons">All horizons</option>
                <option value="Immediate">Immediate</option>
                <option value="1-4 weeks">1-4 weeks</option>
                <option value="1-3 months">1-3 months</option>
              </select>
            </label>
            <Button
              variant="text"
              icon="reset"
              onClick={() => {
                setCategory("All categories")
                setSourceFilter("All")
                setFreshnessFilter("All")
                setSentiment(100)
                setImpact(0)
                setHorizon("All horizons")
                setSelectedId(null)
              }}
            >
              Reset filters
            </Button>
          </div>
          {event && (
            <div className="selected-event-card">
              <span className="selected-label">Selected analysis</span>
              <strong>{event.title}</strong>
              <div className="selected-event-metrics">
                <span>
                  <small>Sentiment</small>
                  <b className={event.sentiment > 0 ? "positive" : "negative"}>
                    {event.sentiment}
                  </b>
                </span>
                <span>
                  <small>Impact</small>
                  <b>{event.impact}/10</b>
                </span>
              </div>
              <dl>
                <div>
                  <dt>Entity</dt>
                  <dd>{event.entity}</dd>
                </div>
                <div>
                  <dt>Class</dt>
                  <dd>{event.category}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{event.source}</dd>
                </div>
              </dl>
              <p>{event.relevanceReason || "This event has been classified as relevant to the current portfolio."}</p>
            </div>
          )}
        </aside>
      </div>
      {explainedEvent && (
        <EventExplainabilityDialog
          event={explainedEvent}
          onClose={() => setExplainedEvent(null)}
          onRunStressTest={(selectedEvent) => {
            setExplainedEvent(null)
            runStressTest(selectedEvent)
          }}
        />
      )}
    </div>
  )
}
