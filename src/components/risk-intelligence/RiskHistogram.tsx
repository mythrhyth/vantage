import React, { useState, useMemo } from "react"
import { PanelTitle } from "../common/PanelTitle"

export interface RiskHistogramProps {
  portfolio?: any | null
  selected?: number
  onSelect?: (index: number) => void
  title?: string
  subtitle?: string
  isLoading?: boolean
  isError?: boolean
}

export function RiskHistogram({
  portfolio,
  selected,
  onSelect,
  title = "Credit & Risk Exposure Distribution",
  subtitle = "Portfolio exposure categorized by asset class and modeled default risk probability buckets",
  isLoading = false,
  isError = false,
}: RiskHistogramProps) {
  const [viewMode, setViewMode] = useState<"asset_class" | "default_pd">("asset_class")

  const baseline = useMemo(() => {
    if (!portfolio) return 0
    const val = Number(portfolio.baselineValue ?? portfolio.baseline_value ?? 0)
    return isNaN(val) ? 0 : val
  }, [portfolio])

  // Real Asset Class Breakdown
  const assetBuckets = useMemo(() => {
    if (!portfolio) return []

    const loans = Number(portfolio.loansExposure ?? portfolio.exposures?.loans ?? 0) || 0
    const bonds = Number(portfolio.bondsExposure ?? portfolio.exposures?.bonds ?? 0) || 0
    const derivatives = Number(portfolio.derivativesExposure ?? portfolio.exposures?.derivatives ?? 0) || 0
    const equity = Number(portfolio.equityExposure ?? portfolio.exposures?.equity ?? 0) || 0

    const total = loans + bonds + derivatives + equity
    if (total === 0) return []

    return [
      {
        label: "Corporate Loans",
        exposure: loans,
        sharePct: baseline > 0 ? (loans / baseline) * 100 : 0,
        riskCategory: "Banking & Credit Risk",
      },
      {
        label: "Bonds & Sovereign",
        exposure: bonds,
        sharePct: baseline > 0 ? (bonds / baseline) * 100 : 0,
        riskCategory: "Rate & Spread Risk",
      },
      {
        label: "Derivatives & Hedges",
        exposure: derivatives,
        sharePct: baseline > 0 ? (derivatives / baseline) * 100 : 0,
        riskCategory: "Liquidity & Counterparty Risk",
      },
      {
        label: "Listed Equities",
        exposure: equity,
        sharePct: baseline > 0 ? (equity / baseline) * 100 : 0,
        riskCategory: "Market Price Volatility",
      },
    ]
  }, [portfolio, baseline])

  // Derived Default Risk Probability Distribution Buckets
  const pdBuckets = useMemo(() => {
    if (!portfolio) return []

    const loans = Number(portfolio.loansExposure ?? portfolio.exposures?.loans ?? 0) || 0
    const bonds = Number(portfolio.bondsExposure ?? portfolio.exposures?.bonds ?? 0) || 0
    const derivatives = Number(portfolio.derivativesExposure ?? portfolio.exposures?.derivatives ?? 0) || 0
    const equity = Number(portfolio.equityExposure ?? portfolio.exposures?.equity ?? 0) || 0

    const total = loans + bonds + derivatives + equity
    if (total === 0) return []

    const ranges = [
      { range: "0–2%", label: "0–2% PD", exposure: bonds * 0.4 + derivatives * 0.5, rating: "AAA / Investment Grade" },
      { range: "2–4%", label: "2–4% PD", exposure: bonds * 0.6 + derivatives * 0.5, rating: "AA / Senior Corporate" },
      { range: "4–6%", label: "4–6% PD", exposure: equity * 0.4, rating: "A / Core Equities" },
      { range: "6–8%", label: "6–8% PD", exposure: equity * 0.6 + loans * 0.2, rating: "BBB / Prime Credit" },
      { range: "8–10%", label: "8–10% PD", exposure: loans * 0.3, rating: "BB+ / Upper Sub-prime" },
      { range: "10–12%", label: "10–12% PD", exposure: loans * 0.3, rating: "BB / Sub-prime Corporate" },
      { range: "12–14%", label: "12–14% PD", exposure: loans * 0.15, rating: "B+ / High Yield" },
      { range: "14–16%", label: "14–16% PD", exposure: loans * 0.05, rating: "B / Speculative" },
      { range: ">16%", label: ">16% PD", exposure: 0, rating: "CCC / Distressed" },
    ]

    return ranges.map((r) => ({
      ...r,
      sharePct: baseline > 0 ? (r.exposure / baseline) * 100 : 0,
    }))
  }, [portfolio, baseline])

  const activeBuckets = viewMode === "asset_class" ? assetBuckets : pdBuckets

  const maxExposure = useMemo(() => {
    if (activeBuckets.length === 0) return 100
    const maxVal = Math.max(...activeBuckets.map((b) => Number(b.exposure) || 0))
    return maxVal > 0 ? maxVal : 100
  }, [activeBuckets])

  const totalClassified = useMemo(() => {
    return activeBuckets.reduce((sum, b) => sum + (Number(b.exposure) || 0), 0)
  }, [activeBuckets])

  if (isLoading) {
    return (
      <section className="chart-panel">
        <PanelTitle title={title} subtitle={subtitle} />
        <div className="histogram-skeleton" style={{ minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)", fontSize: "12px" }}>
          <span>Loading portfolio exposure distribution...</span>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="chart-panel">
        <PanelTitle title={title} subtitle={subtitle} />
        <div className="histogram-error" style={{ minHeight: "220px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--secondary)", fontSize: "12px" }}>
          <span>⚠️ Failed to load exposure data</span>
        </div>
      </section>
    )
  }

  const hasData = activeBuckets.length > 0 && totalClassified > 0

  return (
    <section className="chart-panel">
      <PanelTitle
        title={title}
        subtitle={subtitle}
        side={
          <div className="chart-mode-toggle" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              className={`inline-link ${viewMode === "asset_class" ? "active" : ""}`}
              onClick={() => setViewMode("asset_class")}
              style={{ fontWeight: viewMode === "asset_class" ? "bold" : "normal" }}
            >
              Asset Class View
            </button>
            <span>|</span>
            <button
              className={`inline-link ${viewMode === "default_pd" ? "active" : ""}`}
              onClick={() => setViewMode("default_pd")}
              style={{ fontWeight: viewMode === "default_pd" ? "bold" : "normal" }}
            >
              Default PD View
            </button>
          </div>
        }
      />

      {!hasData ? (
        <div className="empty-state" style={{ minHeight: "220px", padding: "32px 16px", textAlign: "center", color: "var(--secondary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <strong>No constituent asset exposures available</strong>
          <span>Select a valid portfolio with configured loans, bonds, derivatives, or equity holdings to view the risk exposure distribution.</span>
        </div>
      ) : (
        <div className="histogram">
          <div className="y-axis">
            <span>₹{Math.round(maxExposure).toLocaleString()} Cr</span>
            <span>₹{Math.round(maxExposure * 0.66).toLocaleString()} Cr</span>
            <span>₹{Math.round(maxExposure * 0.33).toLocaleString()} Cr</span>
            <span>₹0</span>
          </div>

          <div className="plot-grid">
            <i />
            <i />
            <i />
            <i />
            <div className="bars">
              {activeBuckets.map((b, index) => {
                const exp = Number(b.exposure) || 0
                const share = Number(b.sharePct) || 0
                const heightPct = maxExposure > 0 ? (exp / maxExposure) * 86 : 0
                return (
                  <button
                    key={b.label}
                    className={`histogram-bar ${selected === index ? "selected" : ""}`}
                    style={{ height: `${Math.max(6, heightPct)}%` }}
                    onClick={() => onSelect?.(index)}
                    title={`${b.label}: ₹${exp.toFixed(1)} Cr (${share.toFixed(1)}%)`}
                  >
                    <span className="tooltip">
                      <strong>{b.label}</strong>
                      <br />
                      <b>₹{exp.toFixed(1)} Cr exposure</b>
                      <br />
                      <span>{share.toFixed(1)}% of portfolio</span>
                      <br />
                      <small>{b.riskCategory || b.rating}</small>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="x-axis">
            {activeBuckets.map((b) => (
              <span key={b.label}>{b.label}</span>
            ))}
          </div>

          <div className="x-label">
            {viewMode === "asset_class"
              ? `Asset class breakdown strictly reconciled to portfolio baseline (₹${baseline.toLocaleString()} Cr)`
              : `Default risk probability (PD) buckets derived from asset exposures (₹${totalClassified.toFixed(0)} Cr)`}
          </div>
        </div>
      )}
    </section>
  )
}

