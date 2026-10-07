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
  const [selectedStock, setSelectedStock] = useState<number | null>(null)
  const [overallExplanationOpen, setOverallExplanationOpen] = useState(false)
  const [portfolioMeta, setPortfolioMeta] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [proposed, setProposed] = useState<number[]>([])

  useEffect(() => {
    if (!portfolioId) return
    import("../services/api").then(({ riskApi }) => {
      riskApi.getPortfolio(portfolioId).then(p => {
        if (p) setPortfolioMeta(p)
      }).catch(console.error)

      riskApi.getPortfolioAssets(portfolioId).then(data => {
        const stocksOnly = data.filter((a: any) => a.asset_type === "Stock" || a.asset_type === "EQUITY")
        const mappedAssets = stocksOnly.map((a: any) => ({
          company: a.company || a.ticker,
          ticker: a.ticker || "UNKNOWN",
          current: Number(a.current_weight) || 0,
          sentiment: Number(a.sentiment) || 0,
          sector: a.sector || "Unknown"
        }))
        setAssets(mappedAssets)
      }).catch(console.error)
    })
  }, [portfolioId])

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
          <AllocationHistory sensitivity={sensitivity} />
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
          <Button onClick={() => {
            setCalculated(true)
            if (portfolioId) {
              import("../services/api").then(({ riskApi }) => {
                riskApi.simulateAllocation(portfolioId, sensitivity, maxWeight, maxChange).then(sim => {
                  setProposed(sim.proposed_weights.map((w: any) => Number(w.proposed_weight)))
                })
              })
            }
          }}>
            Recalculate Allocation <Icon name="arrow" size={15} />
          </Button>
          <Button
            variant="text"
            onClick={() => setOverallExplanationOpen(true)}
          >
            Why this allocation?
          </Button>
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
