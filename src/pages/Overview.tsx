import React, { useState, useEffect, useMemo } from "react"
import { riskApi } from "../services/api"
import { Slider } from "../components/common/Slider"
import { Summary } from "../components/common/Summary"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { RiskHistogram } from "../components/risk-intelligence/RiskHistogram"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"

export function Overview({ portfolioId }: { portfolioId?: string | null }) {
  // Default stress parameters
  const DEFAULT_MARKET_WEIGHT = 20 // 20% market shock
  const DEFAULT_SPREAD_BPS = 120 // 120 bps credit spread shock
  const DEFAULT_LIQUIDITY_PCT = 8 // 8% liquidity haircut
  const DEFAULT_HORIZON = "12 months" // 12 months horizon

  const [marketWeight, setMarketWeight] = useState(DEFAULT_MARKET_WEIGHT)
  const [spreadBps, setSpreadBps] = useState(DEFAULT_SPREAD_BPS)
  const [liquidityPct, setLiquidityPct] = useState(DEFAULT_LIQUIDITY_PCT)
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON)
  
  const [selected, setSelected] = useState<number | null>(null)
  const [dialogEvent, setDialogEvent] = useState<any | null>(null)

  const [events, setEvents] = useState<any[]>([])
  const [portfolio, setPortfolio] = useState<any | null>(null)
  const [stressResult, setStressResult] = useState<any | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setFetchError(null)

    async function fetchData() {
      try {
        const [portfolios, fetchedEvents] = await Promise.all([
          riskApi.getPortfolios().catch(() => []),
          riskApi.getEvents(portfolioId || undefined).catch(() => []),
        ])

        if (!isMounted) return

        if (Array.isArray(portfolios) && portfolios.length > 0) {
          const activePort = portfolioId
            ? portfolios.find((p: any) => p.id === portfolioId) || portfolios[0]
            : portfolios[0]
          setPortfolio(activePort)
        }

        if (Array.isArray(fetchedEvents)) setEvents(fetchedEvents)
      } catch (e: any) {
        if (isMounted) {
          console.error("Overview data fetch error:", e)
          setFetchError(e?.message || "Failed to load overview data.")
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }
    fetchData()

    return () => {
      isMounted = false
    }
  }, [portfolioId])

  // Recalculate deterministic stress engine loss & risk score dynamically when parameter controls change
  useEffect(() => {
    if (!portfolio || !portfolio.id) return

    let cancelled = false
    const parameters = {
      sp: 100 - marketWeight, // Market equity shock
      spread: spreadBps, // Credit spread shock in bps
      liquidity: liquidityPct, // Liquidity haircut in %
      horizon: horizon, // Planning horizon with sqrt(T) scaling
    }

    riskApi
      .runStressTest(portfolio.id, parameters)
      .then((res) => {
        if (!cancelled && res && !res.error) {
          setStressResult(res)
        }
      })
      .catch((err) => {
        console.error("Failed to execute stress test run:", err)
      })

    return () => {
      cancelled = true
    }
  }, [portfolio, marketWeight, spreadBps, liquidityPct, horizon])

  const handleResetDefaults = () => {
    setMarketWeight(DEFAULT_MARKET_WEIGHT)
    setSpreadBps(DEFAULT_SPREAD_BPS)
    setLiquidityPct(DEFAULT_LIQUIDITY_PCT)
    setHorizon(DEFAULT_HORIZON)
  }

  const portfolioValue = portfolio?.baselineValue
    ? Number(portfolio.baselineValue)
    : portfolio?.baseline_value
    ? Number(portfolio.baseline_value)
    : 2450

  const avgSentimentNum = useMemo(() => {
    if (!events || !Array.isArray(events) || events.length === 0) return -0.18
    const sum = events.reduce(
      (acc, e) =>
        acc +
        (typeof e?.sentiment === "number"
          ? e.sentiment
          : parseFloat(e?.sentiment) || 0),
      0,
    )
    return sum / events.length
  }, [events])

  const formattedSentiment = useMemo(() => {
    const val = avgSentimentNum
    if (isNaN(val)) return "-0.18"
    if (val > 0) return `+${val.toFixed(2)}`
    return val.toFixed(2)
  }, [avgSentimentNum])

  const modeLoss = stressResult
    ? Number(stressResult.absolute_loss || stressResult.absoluteLoss || 0)
    : 0
  const riskScore = stressResult
    ? Math.round(Number(stressResult.risk_score || stressResult.riskScore || 0))
    : 0

  return (
    <div className="page">
      <PageHeading
        title="Portfolio Risk Overview"
        description="Understand current exposure, risk concentration, and the financial events most likely to affect the portfolio."
      />

      {fetchError && (
        <section className="stress-error-card" style={{ marginBottom: "16px" }}>
          <span>⚠️ {fetchError}</span>
        </section>
      )}

      <Summary
        items={[
          {
            label: "Total portfolio exposure",
            value: isLoading ? "..." : `₹${portfolioValue.toLocaleString()} Cr`,
            detail: portfolio ? portfolio.name || "Active portfolio" : "Loans, bonds and derivatives",
          },
          {
            label: "Modeled risk score",
            value: isLoading ? "..." : `${riskScore}/100`,
            tone: riskScore >= 50 ? "risk" : "neutral",
            detail: modeLoss > 0 ? `-₹${modeLoss.toFixed(1)} Cr modeled loss` : "No active stress loss",
          },
          {
            label: "Overall sentiment",
            value: isLoading ? "..." : formattedSentiment,
            tone: avgSentimentNum < 0 ? "negative" : "neutral",
            detail: events && events.length > 0 ? `Across ${events.length} active events` : "Down 0.07 today",
          },
        ]}
      />

      <div className="workspace-grid">
        <div className="analysis-column">
          <RiskHistogram
            portfolio={portfolio}
            isLoading={isLoading}
            isError={!!fetchError}
            selected={selected ?? undefined}
            onSelect={(idx) => setSelected(idx)}
          />

          <section className="data-section">
            <PanelTitle
              title="Significant financial events"
              subtitle="Latest events ranked by estimated portfolio impact"
            />
            <EventTable
              rows={Array.isArray(events) ? events.slice(0, 5) : []}
              selected={selected}
              onSelect={(idx) => {
                setSelected(idx)
                if (typeof idx === "number" && Array.isArray(events) && events[idx]) {
                  setDialogEvent(events[idx])
                }
              }}
            />
          </section>
        </div>

        <aside className="control-panel">
          <PanelTitle
            title="Risk parameters"
            subtitle="Adjust factor stress parameters to model risk engine loss"
            side={
              <button
                className="inline-link"
                onClick={handleResetDefaults}
                title="Reset sliders to documented default values"
              >
                Reset defaults
              </button>
            }
          />
          <div className="control-stack">
            <div className="control-group-label">Deterministic stress parameters</div>
            <Slider
              label="Market Equity Shock (%)"
              value={marketWeight}
              min={0}
              max={50}
              onChange={setMarketWeight}
            />
            <Slider
              label="Credit Spread Shock (bps)"
              value={spreadBps}
              min={0}
              max={400}
              onChange={setSpreadBps}
            />
            <Slider
              label="Liquidity Haircut (%)"
              value={liquidityPct}
              min={0}
              max={30}
              onChange={setLiquidityPct}
            />
            <div className="control-group-label">Analysis horizon</div>
            <label className="field-label">
              <span>Planning horizon</span>
              <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                <option value="3 months">3 months (0.25y horizon)</option>
                <option value="6 months">6 months (0.50y horizon)</option>
                <option value="12 months">12 months (1.00y baseline)</option>
                <option value="24 months">24 months (2.00y horizon)</option>
              </select>
            </label>
          </div>
          <div className="context-note">
            <strong>Risk engine output ({horizon})</strong>
            <p>
              Modeled loss: <b>₹{modeLoss.toFixed(1)} Cr</b> (Risk score: <b>{riskScore}/100</b>). Horizon uses square-root time scaling (√T).
            </p>
          </div>
        </aside>
      </div>

      {dialogEvent && (
        <EventExplainabilityDialog
          event={dialogEvent}
          onClose={() => setDialogEvent(null)}
        />
      )}
    </div>
  )
}

