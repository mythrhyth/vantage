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

export function IndexAllocation({ portfolioId }: { portfolioId: string | null }) {
  const [sensitivity, setSensitivity] = useState(62)
  const [maxWeight, setMaxWeight] = useState(14)
  const [maxChange, setMaxChange] = useState(2)
  const [sectorLimit, setSectorLimit] = useState(38)
  const [frequency, setFrequency] = useState("Weekly")
  const [cost, setCost] = useState(12)
  const [calculated, setCalculated] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [selectedStock, setSelectedStock] = useState<number | null>(null)
  const [overallExplanationOpen, setOverallExplanationOpen] = useState(false)
  const [portfolioMeta, setPortfolioMeta] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [proposed, setProposed] = useState<number[]>([])

  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleRecalculate = async () => {
    if (recalculating) return;
    setRecalculating(true);
    setCalculated(true);
    setApplySuccess(false);
    try {
      const { riskApi } = await import("../services/api");
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios().catch(() => []);
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (targetId) {
        const sim = await riskApi.simulateAllocation(targetId, sensitivity, maxWeight, maxChange, sectorLimit);
        const list = sim?.proposed_weights || sim?.proposedWeights;
        if (list) {
          setProposed(list.map((w: any) => Number(w.proposedWeight ?? w.proposed_weight ?? w.proposedPct) || 0));
        }
      }
    } catch (err) {
      console.error("Recalculation error:", err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleApplyAllocation = async () => {
    if (applying || assets.length === 0) return;
    setApplying(true);
    setApplySuccess(false);
    setApplyError(null);

    try {
      const { riskApi } = await import("../services/api");
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios().catch(() => []);
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (!targetId) throw new Error("No active portfolio selected");

      const newHoldings = assets.map((a, i) => ({
        ticker: a.ticker,
        company: a.company,
        sector: a.sector,
        currentWeight: proposed[i] !== undefined ? proposed[i] : a.current
      }));

      await riskApi.updateHoldings(targetId, newHoldings);

      const refreshed = await riskApi.getPortfolioAssets(targetId);
      const stocksOnly = refreshed.filter((a: any) => {
        const type = (a.assetType || a.asset_type || "").toUpperCase();
        return type === "STOCK" || type === "EQUITY" || type === "EQUITIES" || Boolean(a.ticker);
      });
      const mappedAssets = stocksOnly.map((a: any) => ({
        company: a.company || a.ticker,
        ticker: a.ticker || "UNKNOWN",
        current: Number(a.currentWeight ?? a.current_weight) || 0,
        sentiment: Number(a.sentiment) || 0,
        sector: a.sector || "Unknown"
      }));
      setAssets(mappedAssets);
      setApplySuccess(true);
    } catch (err: any) {
      console.error("Failed to apply allocation:", err);
      setApplyError(err?.message || "Failed to apply allocation to portfolio.");
    } finally {
      setApplying(false);
    }
  };

  useEffect(() => {
    import("../services/api").then(async ({ riskApi }) => {
      let targetId = portfolioId;
      if (!targetId) {
        const ports = await riskApi.getPortfolios().catch(() => []);
        if (ports && ports.length > 0) targetId = ports[0].id;
      }
      if (!targetId) return;

      riskApi.getPortfolio(targetId).then(p => {
        if (p) setPortfolioMeta(p);
      }).catch(console.error);

      riskApi.getPortfolioAssets(targetId).then(data => {
        const stocksOnly = data.filter((a: any) => {
          const type = (a.assetType || a.asset_type || "").toUpperCase();
          return type === "STOCK" || type === "EQUITY" || type === "EQUITIES" || Boolean(a.ticker);
        });
        const mappedAssets = stocksOnly.map((a: any) => ({
          company: a.company || a.ticker,
          ticker: a.ticker || "UNKNOWN",
          current: Number(a.currentWeight ?? a.current_weight) || 0,
          sentiment: Number(a.sentiment) || 0,
          sector: a.sector || "Unknown"
        }));
        setAssets(mappedAssets);

        // Automatically derive proposed weights from AI/NLP layer
        riskApi.simulateAllocation(targetId, sensitivity, maxWeight, maxChange, sectorLimit).then(sim => {
          if (sim && (sim.proposed_weights || sim.proposedWeights)) {
            const list = sim.proposed_weights || sim.proposedWeights;
            setProposed(list.map((w: any) => Number(w.proposedWeight ?? w.proposed_weight ?? w.proposedPct) || 0));
          }
        }).catch(console.error);
      }).catch(console.error);
    });
  }, [portfolioId, sensitivity, maxWeight, maxChange, sectorLimit])

  const totalEquityWeight = assets.reduce((sum, a) => sum + (Number(a.current) || 0), 0)

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
            value: `${totalEquityWeight.toFixed(1)}%`,
            tone: "positive",
            detail: `${assets.length} active holdings`,
          },
          {
            label: "Proposed turnover",
            value: `${(sensitivity * 0.041).toFixed(1)}%`,
            detail: `Estimated cost ${((sensitivity * 0.041 * cost) / 100).toFixed(2)}%`,
          },
        ]}
      />
      <div className="workspace-grid">
        <div className="analysis-column">
          <AllocationChart assets={assets} proposed={calculated} sensitivity={sensitivity} />
          <AllocationHistory sensitivity={sensitivity} assets={assets} proposed={proposed} />
          <section className="data-section">
            <PanelTitle
              title="Allocation detail"
              subtitle="Weights normalized to 100.0%"
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
                  </tr>
                </thead>
                <tbody>
                  {assets.map((stock, index) => {
                    const change = (proposed[index] ?? stock.current) - stock.current
                    return (
                      <tr
                        key={stock.ticker}
                        onClick={() => setSelectedStock(index)}
                      >
                        <td>
                          <strong>{stock.company}</strong>
                        </td>
                        <td>{stock.ticker}</td>
                        <td>{stock.current.toFixed(1)}%</td>
                        <td
                          className={
                            stock.sentiment > 0 ? "positive" : "negative"
                          }
                        >
                          {stock.sentiment > 0 ? "+" : ""}
                          {stock.sentiment}
                        </td>
                        <td>
                          <b>{(proposed[index] ?? stock.current).toFixed(1)}%</b>
                        </td>
                        <td className={change > 0 ? "positive" : "negative"}>
                          {change > 0 ? "+" : ""}
                          {change.toFixed(1)}%
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
            <div className="stress-status-banner" style={{ margin: "12px 18px 0", fontSize: "11px", color: "var(--positive)" }}>
              <span>✅ Proposed weights saved & applied to portfolio baseline</span>
            </div>
          )}
          {applyError && (
            <div className="stress-error-card" style={{ margin: "12px 18px 0", fontSize: "11px" }}>
              <span>⚠️ {applyError}</span>
            </div>
          )}
          <div className="control-actions" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <Button
              icon="reset"
              disabled={recalculating || applying}
              className={`recalculate-btn ${recalculating ? "loading" : ""}`}
              onClick={handleRecalculate}
            >
              {recalculating ? "Recalculating..." : "Recalculate Allocation"}
            </Button>
            <Button
              variant="primary"
              loading={applying}
              disabled={applying || recalculating || assets.length === 0}
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
      {selectedStock !== null && assets[selectedStock] && (
        <AllocationExplanationDialog assets={assets}
          stock={assets[selectedStock]}
          proposed={proposed[selectedStock] ?? assets[selectedStock].current}
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
          onClose={() => setOverallExplanationOpen(false)}
        />
      )}
    </div>
  )
}
