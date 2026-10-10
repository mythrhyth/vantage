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

export function IndexAllocation({ portfolioId }: { portfolioId: string | null }) {
  const [sensitivity, setSensitivity] = useState(62)
  const [maxWeight, setMaxWeight] = useState(14)
  const [maxChange, setMaxChange] = useState(2)
  const [sectorLimit, setSectorLimit] = useState(38)
  const [frequency, setFrequency] = useState("Weekly")
  const [cost, setCost] = useState(12)
  const [calculated, setCalculated] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [selectedStock, setSelectedStock] = useState<number | null>(null)
  const [overallExplanationOpen, setOverallExplanationOpen] = useState(false)
  const [portfolioMeta, setPortfolioMeta] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [nonEquityCount, setNonEquityCount] = useState<number>(0)
  const [proposed, setProposed] = useState<number[]>([])
  const [proposedMap, setProposedMap] = useState<Record<string, any>>({})
  const [allocationTrace, setAllocationTrace] = useState<any>(null)
  const [historyRuns, setHistoryRuns] = useState<any[]>([])

  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const processAllocationResponse = (simResult: any) => {
    if (!simResult) return;
    const list = simResult.proposed_weights || simResult.proposedWeights || [];
    const map: Record<string, any> = {};
    const arr: number[] = [];

    list.forEach((item: any, idx: number) => {
      const key = (item.ticker || `ASSET_${idx}`).toUpperCase();
      const w = Number(item.proposedWeight ?? item.proposed_weight ?? item.proposedPct) || 0;
      const change = Number(item.weightChange ?? item.weight_change) ?? (w - (item.currentWeight || 0));
      map[key] = {
        ...item,
        proposedWeight: w,
        change,
        status: item.status || 'Optimized',
        reason: item.reason || 'Within optimization constraints'
      };
      arr.push(w);
    });

    setProposedMap(map);
    setProposed(arr);
    if (simResult.trace) setAllocationTrace(simResult.trace);
  };

  const loadHistory = async (id: string) => {
    try {
      const { riskApi } = await import("../services/api");
      const history = await riskApi.getAllocationHistory(id);
      if (Array.isArray(history)) setHistoryRuns(history);
    } catch (err) {
      console.warn("Failed to load allocation history:", err);
    }
  };

  const fetchPortfolioData = async () => {
    setLoading(true);
    setError(null);
    setApplyError(null);
    try {
      const { riskApi } = await import("../services/api");
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios();
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (!targetId) {
        throw new Error("No active portfolio selected or available");
      }

      const p = await riskApi.getPortfolio(targetId);
      if (p) setPortfolioMeta(p);

      await loadHistory(targetId);

      const data = await riskApi.getPortfolioAssets(targetId);
      const isEquityAsset = (a: any) => {
        const type = (a.assetType || a.asset_type || "").toUpperCase();
        return type === "STOCK" || type === "EQUITY" || type === "EQUITIES" || type === "STOCKS" || (Boolean(a.ticker) && !["LOANS", "BONDS", "DERIVATIVES"].includes(type));
      };

      const stocksOnly = data.filter(isEquityAsset);
      const nonEquities = data.filter(a => !isEquityAsset(a));
      setNonEquityCount(nonEquities.length);

      const mappedAssets = stocksOnly.map((a: any) => ({
        id: a.id,
        company: a.company || a.ticker,
        ticker: (a.ticker || "UNKNOWN").toUpperCase(),
        current: Number(a.currentWeight ?? a.current_weight) || 0,
        sentiment: Number(a.sentiment) || 0,
        sector: a.sector || "Unknown"
      }));

      setAssets(mappedAssets);

      if (mappedAssets.length > 0) {
        const sim = await riskApi.simulateAllocation(targetId, sensitivity, maxWeight, maxChange, sectorLimit, frequency, cost);
        processAllocationResponse(sim);
      } else {
        setProposedMap({});
        setProposed([]);
      }
      setLoading(false);
    } catch (err: any) {
      console.error("IndexAllocation fetch error:", err);
      setError(err?.message || "Failed to load holdings from backend database");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, [portfolioId]);

  const handleRecalculate = async () => {
    if (recalculating || loading) return;
    setRecalculating(true);
    setCalculated(true);
    setApplySuccess(false);
    setApplyError(null);
    try {
      const { riskApi } = await import("../services/api");
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios();
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (targetId) {
        const sim = await riskApi.simulateAllocation(targetId, sensitivity, maxWeight, maxChange, sectorLimit, frequency, cost);
        processAllocationResponse(sim);
        await loadHistory(targetId);
      }
    } catch (err: any) {
      console.error("Recalculation error:", err);
      setApplyError(err?.message || "Failed to recalculate allocation.");
    } finally {
      setRecalculating(false);
    }
  };

  const handleApplyAllocation = async () => {
    if (applying || assets.length === 0 || loading) return;
    setApplying(true);
    setApplySuccess(false);
    setApplyError(null);

    try {
      const { riskApi } = await import("../services/api");
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios();
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (!targetId) throw new Error("No active portfolio selected");

      const res = await riskApi.applyAllocation(targetId, sensitivity, maxWeight, maxChange, sectorLimit, frequency, cost);

      const refreshed = await riskApi.getPortfolioAssets(targetId);
      const isEquityAsset = (a: any) => {
        const type = (a.assetType || a.asset_type || "").toUpperCase();
        return type === "STOCK" || type === "EQUITY" || type === "EQUITIES" || type === "STOCKS" || (Boolean(a.ticker) && !["LOANS", "BONDS", "DERIVATIVES"].includes(type));
      };
      const stocksOnly = refreshed.filter(isEquityAsset);
      const mappedAssets = stocksOnly.map((a: any) => ({
        id: a.id,
        company: a.company || a.ticker,
        ticker: (a.ticker || "UNKNOWN").toUpperCase(),
        current: Number(a.currentWeight ?? a.current_weight) || 0,
        sentiment: Number(a.sentiment) || 0,
        sector: a.sector || "Unknown"
      }));
      setAssets(mappedAssets);

      if (res.result) processAllocationResponse(res.result);
      await loadHistory(targetId);

      setApplySuccess(true);
    } catch (err: any) {
      console.error("Failed to apply allocation:", err);
      setApplyError(err?.message || "Failed to apply allocation to portfolio.");
    } finally {
      setApplying(false);
    }
  };

  const totalEquityWeight = assets.reduce((sum, a) => sum + (Number(a.current) || 0), 0)
  const turnoverPct = allocationTrace?.metrics?.totalTurnoverPct !== undefined ? Number(allocationTrace.metrics.totalTurnoverPct) : (sensitivity * 0.041)
  const estimatedCostVal = allocationTrace?.metrics?.estimatedTransactionCostVal !== undefined ? Number(allocationTrace.metrics.estimatedTransactionCostVal) : ((turnoverPct * 2450.0 * 2 * cost) / 10000)

  return (
    <div className="page">
      <PageHeading
        title="Index Allocation"
        description="Compare current and proposed stock weights using sentiment signals and portfolio allocation constraints."
      />
      <Summary
        items={[
          { label: "Index universe", value: portfolioMeta?.index_universe || "NIFTY 50", detail: "Allocation benchmark" },
          {
            label: "Total equity weight",
            value: `${totalEquityWeight.toFixed(2)}%`,
            tone: "positive",
            detail: `${assets.length} equity holdings (${nonEquityCount} non-equity excluded)`,
          },
          {
            label: "Proposed turnover",
            value: `${turnoverPct.toFixed(2)}%`,
            detail: `Est. cost: $${estimatedCostVal.toFixed(2)} (${cost} bps)`,
          },
        ]}
      />

      {loading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", margin: "24px 0" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            ⏳ Loading equity holdings from database...
          </div>
          <div style={{ fontSize: "13px", color: "var(--secondary)" }}>
            Fetching portfolio assets and running allocation optimizer simulation.
          </div>
        </div>
      ) : error ? (
        <div style={{ padding: "32px 24px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid var(--negative)", borderRadius: "8px", margin: "24px 0", textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--negative)", marginBottom: "8px" }}>
            ⚠️ Failed to Load Portfolio Holdings
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "20px" }}>
            {error}
          </div>
          <Button variant="primary" icon="reset" onClick={fetchPortfolioData}>
            Retry Loading Holdings
          </Button>
        </div>
      ) : assets.length === 0 ? (
        <div style={{ padding: "48px 24px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", margin: "24px 0", textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
            📁 No Eligible Equity Holdings Found
          </div>
          <div style={{ fontSize: "13px", color: "var(--secondary)" }}>
            The selected portfolio contains no equity assets eligible for index rebalancing.
            {nonEquityCount > 0 && ` (${nonEquityCount} non-equity holdings excluded from index allocation)`}
          </div>
        </div>
      ) : (
        <div className="workspace-grid">
          <div className="analysis-column">
            <AllocationChart assets={assets} proposedMap={proposedMap} proposed={calculated} sensitivity={sensitivity} />
            <AllocationHistory sensitivity={sensitivity} assets={assets} proposed={proposedMap} historyRuns={historyRuns} portfolioId={portfolioId} />
            <section className="data-section">
              <PanelTitle
                title="Allocation detail"
                subtitle="Weights normalized to target baseline total"
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Ticker</th>
                      <th>Current weight</th>
                      <th>Sentiment</th>
                      <th>Proposed weight</th>
                      <th>Change</th>
                      <th>Binding constraint</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((stock, index) => {
                      const tickKey = (stock.ticker || "").toUpperCase()
                      const propInfo = proposedMap[tickKey] || proposedMap[stock.ticker]
                      const targetW = propInfo ? propInfo.proposedWeight : (proposed[index] ?? stock.current)
                      const change = targetW - stock.current
                      const statusText = propInfo?.status || (change > 0 ? "Increased" : change < 0 ? "Decreased" : "Unchanged")

                      return (
                        <tr
                          key={stock.ticker}
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedStock(index)}
                        >
                          <td>
                            <strong>{stock.company}</strong>
                          </td>
                          <td>{stock.ticker}</td>
                          <td>{stock.current.toFixed(2)}%</td>
                          <td
                            className={
                              stock.sentiment > 0 ? "positive" : stock.sentiment < 0 ? "negative" : ""
                            }
                          >
                            {stock.sentiment > 0 ? "+" : ""}
                            {stock.sentiment.toFixed(2)}
                          </td>
                          <td>
                            <b>{targetW.toFixed(2)}%</b>
                          </td>
                          <td className={change > 0 ? "positive" : change < 0 ? "negative" : ""}>
                            {change > 0 ? "+" : ""}
                            {change.toFixed(2)} pp
                          </td>
                          <td style={{ fontSize: "11px", color: propInfo?.bindingConstraint && propInfo.bindingConstraint !== 'UNCONSTRAINED' ? "var(--warning)" : "var(--secondary)" }}>
                            {statusText}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <aside className="control-panel">
            <PanelTitle
              title="Allocation parameters"
              subtitle="Define portfolio constraints"
            />
            <div className="control-stack">
              <div className="control-group-label">Signal response</div>
              <Slider
                label="Sentiment sensitivity"
                value={sensitivity}
                min={0}
                max={100}
                onChange={(value) => {
                  setSensitivity(value)
                  setCalculated(false)
                }}
              />
              <div className="control-group-label">Portfolio constraints</div>
              <Slider
                label="Maximum stock weight"
                value={maxWeight}
                min={8}
                max={20}
                suffix="%"
                onChange={(value) => {
                  setMaxWeight(value)
                  setCalculated(false)
                }}
              />
              <Slider
                label="Maximum allocation change"
                value={maxChange}
                min={0.5}
                max={4}
                step={0.5}
                suffix="%"
                onChange={(value) => {
                  setMaxChange(value)
                  setCalculated(false)
                }}
              />
              <Slider
                label="Sector exposure limit"
                value={sectorLimit}
                min={25}
                max={50}
                suffix="%"
                onChange={setSectorLimit}
              />
              <div className="control-group-label">Execution assumptions</div>
              <label className="field-label">
                <span>Rebalancing frequency</span>
                <select
                  value={frequency}
                  onChange={(event) => setFrequency(event.target.value)}
                >
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </label>
              <Slider
                label="Transaction cost"
                value={cost}
                min={0}
                max={30}
                suffix=" bps"
                onChange={setCost}
              />
            </div>
            {applySuccess && (
              <div className="stress-status-banner allocation-result-banner">
                <span>✅ Proposed weights applied & persisted to historical database</span>
              </div>
            )}
            {applyError && (
              <div className="stress-error-card allocation-result-banner">
                <span>⚠️ {applyError}</span>
              </div>
            )}
            <div className="allocation-control-actions">
              <Button
                icon="reset"
                disabled={recalculating || applying || loading}
                className={`recalculate-btn ${recalculating ? "loading" : ""}`}
                onClick={handleRecalculate}
              >
                {recalculating ? "Recalculating..." : "Recalculate Allocation"}
              </Button>
              <Button
                variant="primary"
                loading={applying}
                disabled={applying || recalculating || loading || assets.length === 0}
                onClick={handleApplyAllocation}
              >
                {applying ? "Applying to Portfolio..." : "Apply Proposed Allocation"}
              </Button>
              <Button
                variant="text"
                className="why-allocation-btn"
                onClick={() => setOverallExplanationOpen(true)}
              >
                Why this allocation?
              </Button>
            </div>
          </aside>
        </div>
      )}

      {selectedStock !== null && assets[selectedStock] && (
        <AllocationExplanationDialog
          assets={assets}
          stock={{
            ...assets[selectedStock],
            ...(proposedMap[(assets[selectedStock].ticker || "").toUpperCase()] || proposedMap[assets[selectedStock].ticker] || {})
          }}
          proposed={(proposedMap[(assets[selectedStock].ticker || "").toUpperCase()] || proposedMap[assets[selectedStock].ticker])?.proposedWeight ?? assets[selectedStock].current}
          allProposed={proposed}
          sensitivity={sensitivity}
          maxWeight={maxWeight}
          maxChange={maxChange}
          sectorLimit={sectorLimit}
          cost={cost}
          onClose={() => setSelectedStock(null)}
        />
      )}
      {overallExplanationOpen && (
        <OverallAllocationDialog
          sensitivity={sensitivity}
          maxWeight={maxWeight}
          maxChange={maxChange}
          sectorLimit={sectorLimit}
          frequency={frequency}
          cost={cost}
          trace={allocationTrace}
          onClose={() => setOverallExplanationOpen(false)}
        />
      )}
    </div>
  )
}
