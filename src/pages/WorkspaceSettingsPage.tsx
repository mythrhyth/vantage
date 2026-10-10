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

import { PortfolioSetupPage } from "./PortfolioSetupPage"
import { IngestionSourceInput, riskApi } from "../services/api"

const emptySourceDraft: IngestionSourceInput = {
  name: "",
  domain: "",
  sourceType: "Financial News",
  feedUrl: "",
  enabled: true,
  fetchInterval: 15,
  maxItemsPerRun: 20,
}

export function WorkspaceSettingsPage({
  dark,
  setDark,
  portfolioId = null
}: {
  dark: boolean
  setDark: (dark: boolean) => void
  portfolioId?: string | null
}) {
  const [activeTab, setActiveTab] = useState<"portfolio" | "ingestion" | "general">("portfolio")
  const [density, setDensity] = useState("Comfortable")
  const [currency, setCurrency] = useState("INR")
  const [dateFormat, setDateFormat] = useState("DD MMM YYYY")
  const [alerts, setAlerts] = useState(true)
  const [autoRecalculate, setAutoRecalculate] = useState(false)
  const [saved, setSaved] = useState(false)

  // Ingestion settings state
  const [sources, setSources] = useState<Awaited<ReturnType<typeof riskApi.getSources>>>([])
  const [sourceFormOpen, setSourceFormOpen] = useState(false)
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null)
  const [sourceDraft, setSourceDraft] = useState<IngestionSourceInput>(emptySourceDraft)
  const [sourceError, setSourceError] = useState("")
  const [freshnessWindow, setFreshnessWindow] = useState("LAST_24_HOURS")
  const [maxArticles, setMaxArticles] = useState(20)
  const [autoAnalyze, setAutoAnalyze] = useState(true)
  const [deduplicateSimilar, setDeduplicateSimilar] = useState(true)

  useEffect(() => {
    riskApi.getSources().then(setSources).catch((error: Error) => {
      setSourceError(`Failed to load ingestion sources: ${error.message}`);
    });
    riskApi.getSettings().then(st => {
      if (typeof st.freshness_window === "string") setFreshnessWindow(st.freshness_window);
      if (typeof st.max_items_per_source === "number") setMaxArticles(st.max_items_per_source);
      if (typeof st.auto_analyze === "boolean") setAutoAnalyze(st.auto_analyze);
      if (typeof st.deduplicate_similar === "boolean") setDeduplicateSimilar(st.deduplicate_similar);
    }).catch((error: Error) => {
      setSourceError(`Failed to load ingestion settings: ${error.message}`);
    });
  }, []);

  const handleToggleSource = async (id: string, enabled: boolean) => {
    const originalEnabled = sources.find(source => source.id === id)?.enabled;
    setSources(prev => prev.map(source => source.id === id ? { ...source, enabled } : source));
    setSourceError("");
    try {
      await riskApi.toggleSource(id, enabled);
    } catch (error) {
      setSources(prev => prev.map(source =>
        source.id === id ? { ...source, enabled: originalEnabled ?? source.enabled } : source
      ));
      setSourceError(`Failed to update source: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const openNewSourceForm = () => {
    setSourceDraft(emptySourceDraft);
    setEditingSourceId(null);
    setSourceFormOpen(true);
    setSourceError("");
  };

  const openEditSourceForm = (source: (typeof sources)[number]) => {
    setSourceDraft({
      name: source.name,
      domain: source.domain,
      sourceType: source.sourceType,
      feedUrl: source.feedUrl,
      enabled: source.enabled,
      fetchInterval: source.fetchInterval,
      maxItemsPerRun: source.maxItemsPerRun,
    });
    setEditingSourceId(source.id);
    setSourceFormOpen(true);
    setSourceError("");
  };

  const closeSourceForm = () => {
    setSourceFormOpen(false);
    setEditingSourceId(null);
    setSourceDraft(emptySourceDraft);
    setSourceError("");
  };

  const handleSourceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSourceError("");
    try {
      if (editingSourceId) {
        const updated = await riskApi.updateSource(editingSourceId, sourceDraft);
        setSources(prev => prev.map(source => source.id === updated.id ? updated : source));
      } else {
        const created = await riskApi.createSource(sourceDraft);
        setSources(prev => [...prev, created]);
      }
      closeSourceForm();
    } catch (error) {
      setSourceError(`Failed to save source: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleSaveChanges = () => {
    riskApi.updateSettings({
      freshnessWindow,
      maxItemsPerSource: maxArticles,
      autoAnalyze,
      deduplicateSimilar
    }).then(() => {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    }).catch(err => alert("Failed to save settings: " + err.message));
  };

  return (
    <div className="page settings-page">
      <div className="settings-page-heading">
        <div>
          <strong>Workspace settings</strong>
          <span>Manage portfolio holdings, baseline exposure, news ingestion sources, and workspace appearance.</span>
        </div>
        {activeTab !== "portfolio" && (
          <Button onClick={handleSaveChanges}>
            Save changes
          </Button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "14px" }}>
        <button
          onClick={() => setActiveTab("portfolio")}
          style={{
            padding: "10px 18px",
            borderRadius: "6px",
            border: activeTab === "portfolio" ? "1px solid var(--accent)" : "1px solid transparent",
            background: activeTab === "portfolio" ? "var(--accent-soft)" : "transparent",
            color: activeTab === "portfolio" ? "var(--accent)" : "var(--secondary)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease"
          }}
        >
          <Icon name="portfolio" size={16} /> Portfolio Setup & Holdings
        </button>

        <button
          onClick={() => setActiveTab("ingestion")}
          style={{
            padding: "10px 18px",
            borderRadius: "6px",
            border: activeTab === "ingestion" ? "1px solid var(--accent)" : "1px solid transparent",
            background: activeTab === "ingestion" ? "var(--accent-soft)" : "transparent",
            color: activeTab === "ingestion" ? "var(--accent)" : "var(--secondary)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease"
          }}
        >
          <Icon name="intelligence" size={16} /> News Ingestion & Sources
        </button>

        <button
          onClick={() => setActiveTab("general")}
          style={{
            padding: "10px 18px",
            borderRadius: "6px",
            border: activeTab === "general" ? "1px solid var(--accent)" : "1px solid transparent",
            background: activeTab === "general" ? "var(--accent-soft)" : "transparent",
            color: activeTab === "general" ? "var(--accent)" : "var(--secondary)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            transition: "all 0.15s ease"
          }}
        >
          <Icon name="settings" size={16} /> Workspace & Appearance
        </button>
      </div>

      {saved && (
        <div className="settings-saved">Workspace preferences saved.</div>
      )}

      {activeTab === "portfolio" && (
        <PortfolioSetupPage portfolioId={portfolioId} />
      )}

      {activeTab === "ingestion" && (
        <div className="settings-page-grid">
          <section className="settings-page-section">
            <PanelTitle
              title="Trusted News Sources"
              subtitle="Manage RSS feeds used directly by ingestion"
            />
            <div className="settings-content">
              {sourceError && (
                <div role="alert" style={{ color: "var(--negative)", padding: "10px 0" }}>{sourceError}</div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 0" }}>
                <Button variant="outline" onClick={openNewSourceForm}>Add source</Button>
              </div>
              {sourceFormOpen && (
                <form
                  onSubmit={handleSourceSubmit}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                    gap: "12px",
                    padding: "14px",
                    marginBottom: "14px",
                    border: "1px solid var(--border)",
                  }}
                >
                  <label className="field-label">
                    <span>Source name</span>
                    <input required value={sourceDraft.name} onChange={event => setSourceDraft({ ...sourceDraft, name: event.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>Website URL</span>
                    <input required type="url" value={sourceDraft.domain} onChange={event => setSourceDraft({ ...sourceDraft, domain: event.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>Source type</span>
                    <input required value={sourceDraft.sourceType} onChange={event => setSourceDraft({ ...sourceDraft, sourceType: event.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>RSS feed URL</span>
                    <input required type="url" value={sourceDraft.feedUrl} onChange={event => setSourceDraft({ ...sourceDraft, feedUrl: event.target.value })} />
                  </label>
                  <label className="field-label">
                    <span>Fetch interval (minutes)</span>
                    <input required type="number" min={1} step={1} value={sourceDraft.fetchInterval} onChange={event => setSourceDraft({ ...sourceDraft, fetchInterval: Number(event.target.value) })} />
                  </label>
                  <label className="field-label">
                    <span>Maximum items per run</span>
                    <input required type="number" min={1} max={100} step={1} value={sourceDraft.maxItemsPerRun} onChange={event => setSourceDraft({ ...sourceDraft, maxItemsPerRun: Number(event.target.value) })} />
                  </label>
                  <label className="settings-row" style={{ gridColumn: "1 / -1" }}>
                    <span><b>Enabled</b></span>
                    <input type="checkbox" checked={sourceDraft.enabled} onChange={event => setSourceDraft({ ...sourceDraft, enabled: event.target.checked })} />
                  </label>
                  <div style={{ display: "flex", gap: "8px", gridColumn: "1 / -1" }}>
                    <button className="button button-primary" type="submit">
                      {editingSourceId ? "Save source" : "Add source"}
                    </button>
                    <Button variant="secondary" onClick={closeSourceForm}>Cancel</Button>
                  </div>
                </form>
              )}
              <div className="sources-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {sources.map((src) => (
                  <div key={src.id} className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <b>{src.name}</b>
                      <small style={{ display: 'block', color: 'var(--text-muted, #888)' }}>{src.domain} · {src.sourceType} · max {src.maxItemsPerRun}/run</small>
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Button variant="text" onClick={() => openEditSourceForm(src)}>Edit</Button>
                      <button
                        className={`switch ${src.enabled ? "active" : ""}`}
                        aria-label={`${src.enabled ? "Disable" : "Enable"} ${src.name}`}
                        aria-pressed={src.enabled}
                        onClick={() => handleToggleSource(src.id, !src.enabled)}
                      >
                        <i />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="settings-page-section">
            <PanelTitle
              title="News Freshness & Ingestion Controls"
              subtitle="Configure freshness cutoff and deduplication behavior"
            />
            <div className="settings-content">
              <label className="field-label">
                <span>News freshness window</span>
                <select
                  value={freshnessWindow}
                  onChange={(e) => setFreshnessWindow(e.target.value)}
                >
                  <option value="LAST_1_HOUR">1 hour</option>
                  <option value="LAST_6_HOURS">6 hours</option>
                  <option value="LAST_24_HOURS">24 hours (Default)</option>
                  <option value="LAST_3_DAYS">3 days</option>
                  <option value="LAST_7_DAYS">7 days</option>
                  <option value="CUSTOM">Custom</option>
                </select>
              </label>

              <label className="field-label" style={{ marginTop: '12px' }}>
                <span>Maximum articles / source</span>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={maxArticles}
                  onChange={(e) => setMaxArticles(Number(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #ccc)',
                    background: 'var(--bg-card, #fff)',
                    color: 'inherit',
                    marginTop: '4px'
                  }}
                />
              </label>

              <div className="settings-row" style={{ marginTop: '16px' }}>
                <span>
                  <b>Auto-analyze with Gemini</b>
                  <small>Automatically extract risk intelligence for portfolio-relevant articles</small>
                </span>
                <button
                  className={`switch ${autoAnalyze ? "active" : ""}`}
                  onClick={() => setAutoAnalyze(!autoAnalyze)}
                >
                  <i />
                </button>
              </div>

              <div className="settings-row">
                <span>
                  <b>Deduplicate similar events</b>
                  <small>Cluster articles reporting the same underlying real-world event</small>
                </span>
                <button
                  className={`switch ${deduplicateSimilar ? "active" : ""}`}
                  onClick={() => setDeduplicateSimilar(!deduplicateSimilar)}
                >
                  <i />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === "general" && (
        <div className="settings-page-grid">
          <section className="settings-page-section">
            <PanelTitle
              title="Appearance"
              subtitle="Control how the analytical workspace is displayed"
            />
            <div className="settings-content">
              <div className="settings-row">
                <span>
                  <b>Dark theme</b>
                  <small>Use the dark analytical workspace</small>
                </span>
                <button
                  className={`switch ${dark ? "active" : ""}`}
                  onClick={() => setDark(!dark)}
                >
                  <i />
                </button>
              </div>
              <label className="field-label">
                <span>Interface density</span>
                <select
                  value={density}
                  onChange={(event) => setDensity(event.target.value)}
                >
                  <option>Comfortable</option>
                  <option>Compact</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-page-section">
            <PanelTitle
              title="Financial display"
              subtitle="Reporting conventions used across all analysis"
            />
            <div className="settings-content">
              <label className="field-label">
                <span>Reporting currency</span>
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  <option>INR</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
              <label className="field-label">
                <span>Date format</span>
                <select
                  value={dateFormat}
                  onChange={(event) => setDateFormat(event.target.value)}
                >
                  <option>DD MMM YYYY</option>
                  <option>MM/DD/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </label>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
