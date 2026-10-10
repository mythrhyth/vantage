import React, { useState, useEffect } from "react"
import { PageHeading } from "../components/common/PageHeading"
import { PanelTitle } from "../components/common/PanelTitle"
import { Button } from "../components/common/Button"
import { Icon } from "../components/common/Icon"
import { Summary } from "../components/common/Summary"
import { riskApi } from "../services/api"
import { isEquityAsset } from "../utils/assetHelpers"

interface EquityHolding {
  id?: string
  ticker: string
  company: string
  sector: string
  currentWeight: number
}

const AVAILABLE_INDICES = [
  "NIFTY 50",
  "S&P 500",
  "NASDAQ 100",
  "BSE SENSEX",
  "MSCI World",
  "FTSE 100"
]

const SECTOR_OPTIONS = [
  "Technology",
  "Financials",
  "Energy",
  "Consumer Staples",
  "Automotive",
  "Healthcare",
  "Industrials",
  "Telecommunications"
]

export function PortfolioSetupPage({
  portfolioId,
  onSaveSuccess,
  embedded = true
}: {
  portfolioId: string | null
  onSaveSuccess?: () => void
  embedded?: boolean
}) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Portfolio level state
  const [portfolioName, setPortfolioName] = useState("Main Banking Portfolio")
  const [totalValue, setTotalValue] = useState<number>(2450)
  const [indexUniverse, setIndexUniverse] = useState("NIFTY 50")

  // Non-equity exposures (30%, 17%, 10% of 2450 Cr baseline)
  const [loansExposure, setLoansExposure] = useState<number>(735)
  const [bondsExposure, setBondsExposure] = useState<number>(416.5)
  const [derivativesExposure, setDerivativesExposure] = useState<number>(245)

  // Equity holdings
  const [holdings, setHoldings] = useState<EquityHolding[]>([])

  // New holding form state
  const [newTicker, setNewTicker] = useState("")
  const [newCompany, setNewCompany] = useState("")
  const [newSector, setNewSector] = useState("Technology")
  const [newWeight, setNewWeight] = useState<number>(5.0)

  const loadPortfolioData = async () => {
    setLoading(true)
    try {
      let targetId = portfolioId
      if (!targetId) {
        const portfolios = await riskApi.getPortfolios()
        if (portfolios && portfolios.length > 0) {
          targetId = portfolios[0].id
        }
      }
      if (!targetId) {
        setLoading(false)
        return
      }

      const data = await riskApi.getPortfolio(targetId)
      if (data) {
        setPortfolioName(data.name || "Main Banking Portfolio")
        setTotalValue(data.baselineValue ?? data.baseline_value ?? 2450)
        setIndexUniverse(data.indexUniverse || data.index_universe || "NIFTY 50")
        
        if (data.exposures) {
          setLoansExposure(data.exposures.loans ?? 0)
          setBondsExposure(data.exposures.bonds ?? 0)
          setDerivativesExposure(data.exposures.derivatives ?? 0)
        } else {
          setLoansExposure(data.loansExposure ?? 0)
          setBondsExposure(data.bondsExposure ?? 0)
          setDerivativesExposure(data.derivativesExposure ?? 0)
        }

        const rawList = data.holdings || data.assets
        if (Array.isArray(rawList)) {
          const equityAssets = rawList
            .filter((a: any) => isEquityAsset(a.assetType || a.asset_type))
            .map((a: any) => ({
              id: a.id,
              ticker: a.ticker || "",
              company: a.company || a.ticker || "",
              sector: a.sector || "Technology",
              currentWeight: Number(a.currentWeight ?? a.current_weight) || 0
            }))
          setHoldings(equityAssets)
        }
      }
    } catch (e: any) {
      console.error("Failed to load portfolio:", e)
      setStatusMsg({ type: "error", text: e?.message || "Failed to load portfolio details" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPortfolioData()
  }, [portfolioId])

  const totalEquityWeight = holdings.reduce((sum, h) => sum + (Number(h.currentWeight) || 0), 0)
  const totalEquityExposure = (totalEquityWeight / 100) * totalValue
  const totalExposuresSum = loansExposure + bondsExposure + derivativesExposure + totalEquityExposure

  const handleWeightChange = (index: number, val: number) => {
    const updated = [...holdings]
    updated[index].currentWeight = val
    setHoldings(updated)
  }

  const handleFieldChange = (index: number, field: keyof EquityHolding, val: any) => {
    const updated = [...holdings]
    updated[index] = { ...updated[index], [field]: val }
    setHoldings(updated)
  }

  const handleRemoveHolding = (index: number) => {
    const updated = holdings.filter((_, i) => i !== index)
    setHoldings(updated)
  }

  const handleAddHolding = () => {
    if (!newTicker.trim()) {
      setStatusMsg({ type: "error", text: "Please enter a valid stock ticker symbol" })
      return
    }
    const cleanTicker = newTicker.trim().toUpperCase()
    if (holdings.some(h => h.ticker.toUpperCase() === cleanTicker)) {
      setStatusMsg({ type: "error", text: `Ticker ${cleanTicker} is already in the portfolio` })
      return
    }
    if (newWeight < 0 || newWeight > 100) {
      setStatusMsg({ type: "error", text: "Stock weight must be between 0% and 100%" })
      return
    }

    const newEntry: EquityHolding = {
      ticker: cleanTicker,
      company: newCompany.trim() || cleanTicker,
      sector: newSector,
      currentWeight: Number(newWeight)
    }

    setHoldings([...holdings, newEntry])
    setNewTicker("")
    setNewCompany("")
    setNewWeight(5.0)
    setStatusMsg(null)
  }

  const handleSave = async () => {
    if (!portfolioId) return
    setStatusMsg(null)

    // Validation
    if (totalValue <= 0) {
      setStatusMsg({ type: "error", text: "Portfolio total value must be greater than zero." })
      return
    }
    if (loansExposure < 0 || bondsExposure < 0 || derivativesExposure < 0) {
      setStatusMsg({ type: "error", text: "Asset exposure values cannot be negative." })
      return
    }

    // Equity weight validation
    const uniqueTickers = new Set(holdings.map(h => h.ticker.trim().toUpperCase()))
    if (uniqueTickers.size !== holdings.length) {
      setStatusMsg({ type: "error", text: "Duplicate tickers detected in equity holdings." })
      return
    }

    if (totalEquityWeight > 100) {
      setStatusMsg({ type: "error", text: `Total equity weight (${totalEquityWeight.toFixed(1)}%) exceeds 100%. Please adjust holding weights.` })
      return
    }

    setSaving(true)
    try {
      // 1. Update Portfolio master info & non-equity exposures
      await riskApi.updatePortfolio(portfolioId, {
        name: portfolioName,
        baselineValue: totalValue,
        indexUniverse,
        loansExposure,
        bondsExposure,
        derivativesExposure
      })

      // 2. Update Equity Holdings
      await riskApi.updateHoldings(portfolioId, holdings.map(h => ({
        ticker: h.ticker,
        company: h.company,
        currentWeight: h.currentWeight,
        sector: h.sector
      })))

      setStatusMsg({ type: "success", text: "Portfolio configuration and holdings updated successfully." })
      if (onSaveSuccess) onSaveSuccess()
      await loadPortfolioData()
    } catch (e: any) {
      console.error("Save error:", e)
      setStatusMsg({ type: "error", text: e?.message || "Failed to save portfolio settings." })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={embedded ? "" : "page"}>
        {!embedded && <PageHeading title="Portfolio Setup & Holdings" description="Loading portfolio data..." />}
        <div style={{ padding: "40px", textAlign: "center", color: "var(--secondary)" }}>Loading portfolio setup...</div>
      </div>
    )
  }

  return (
    <div className={embedded ? "" : "page"}>
      {!embedded && (
        <PageHeading
          title="Portfolio Setup & Holdings"
          description="Configure your baseline portfolio value, asset exposures (Loans, Bonds, Derivatives), index universe, and individual stock holdings."
        />
      )}

      {statusMsg && (
        <div
          className={`status-banner ${statusMsg.type}`}
          style={{
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "20px",
            background: statusMsg.type === "success" ? "color-mix(in srgb, var(--positive) 15%, var(--panel))" : "color-mix(in srgb, var(--negative) 15%, var(--panel))",
            border: `1px solid ${statusMsg.type === "success" ? "var(--positive)" : "var(--negative)"}`,
            color: statusMsg.type === "success" ? "var(--positive)" : "var(--negative)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <span>{statusMsg.text}</span>
          <button
            onClick={() => setStatusMsg(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <Summary
        items={[
          {
            label: "Total Portfolio Value",
            value: `₹${totalValue.toLocaleString()} Cr`,
            detail: "Baseline Capital"
          },
          {
            label: "Index Universe",
            value: indexUniverse,
            detail: "Allocation benchmark"
          },
          {
            label: "Equity Holdings",
            value: `${holdings.length} Assets`,
            detail: `${totalEquityWeight.toFixed(1)}% of total portfolio`
          },
          {
            label: "Total Exposure Sum",
            value: `₹${totalExposuresSum.toFixed(1)} Cr`,
            detail: `${((totalExposuresSum / (totalValue || 1)) * 100).toFixed(1)}% of baseline`
          }
        ]}
      />

      <div className="workspace-grid">
        <div className="analysis-column">
          {/* Main Settings Section */}
          <section className="data-section" style={{ marginBottom: "24px" }}>
            <PanelTitle title="1. Portfolio Baseline & Benchmark" subtitle="Define overall capital & target index" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", padding: "18px" }}>
              <label className="field-label" style={{ padding: 0 }}>
                <span>Portfolio Name</span>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={e => setPortfolioName(e.target.value)}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                />
              </label>

              <label className="field-label" style={{ padding: 0 }}>
                <span>Index Allocation Universe</span>
                <select
                  value={indexUniverse}
                  onChange={e => setIndexUniverse(e.target.value)}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                >
                  {AVAILABLE_INDICES.map(idx => (
                    <option key={idx} value={idx}>{idx}</option>
                  ))}
                </select>
              </label>

              <label className="field-label" style={{ padding: 0, gridColumn: "1 / -1" }}>
                <span>Total Portfolio Value (₹ Cr)</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={totalValue}
                  onChange={e => setTotalValue(Number(e.target.value))}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                />
              </label>
            </div>
          </section>

          {/* Exposures Section */}
          <section className="data-section" style={{ marginBottom: "24px" }}>
            <PanelTitle title="2. Asset Class Exposures" subtitle="Banking & fixed income positions (₹ Cr)" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", padding: "18px" }}>
              <label className="field-label" style={{ padding: 0 }}>
                <span>Loans Exposure (₹ Cr)</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={loansExposure}
                  onChange={e => setLoansExposure(Number(e.target.value))}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                />
                <small style={{ color: "var(--secondary)", marginTop: "4px" }}>{((loansExposure / (totalValue || 1)) * 100).toFixed(1)}% of portfolio</small>
              </label>

              <label className="field-label" style={{ padding: 0 }}>
                <span>Bonds Exposure (₹ Cr)</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={bondsExposure}
                  onChange={e => setBondsExposure(Number(e.target.value))}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                />
                <small style={{ color: "var(--secondary)", marginTop: "4px" }}>{((bondsExposure / (totalValue || 1)) * 100).toFixed(1)}% of portfolio</small>
              </label>

              <label className="field-label" style={{ padding: 0 }}>
                <span>Derivatives Exposure (₹ Cr)</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={derivativesExposure}
                  onChange={e => setDerivativesExposure(Number(e.target.value))}
                  style={{ width: "100%", height: "42px", padding: "0 12px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                />
                <small style={{ color: "var(--secondary)", marginTop: "4px" }}>{((derivativesExposure / (totalValue || 1)) * 100).toFixed(1)}% of portfolio</small>
              </label>
            </div>
          </section>

          {/* Equity Holdings Section */}
          <section className="data-section">
            <PanelTitle
              title="3. Equity Holdings & Weights"
              subtitle={`Current stock allocations (${totalEquityWeight.toFixed(1)}% total)`}
            />

            {totalEquityWeight > 100 && (
              <div style={{ margin: "12px 18px", padding: "12px 16px", background: "color-mix(in srgb, var(--negative) 15%, var(--panel))", color: "var(--negative)", borderRadius: "4px", border: "1px solid var(--negative)" }}>
                ⚠️ Total equity weight exceeds 100% ({totalEquityWeight.toFixed(1)}%). Please reduce individual weights before saving.
              </div>
            )}

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Company Name</th>
                    <th>Sector</th>
                    <th>Weight (%)</th>
                    <th>Value (₹ Cr)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: "28px", color: "var(--secondary)" }}>
                        No equity holdings configured. Add stock holdings below.
                      </td>
                    </tr>
                  ) : (
                    holdings.map((h, idx) => {
                      const holdingValue = (h.currentWeight / 100) * totalValue
                      return (
                        <tr key={h.ticker + idx}>
                          <td>
                            <input
                              type="text"
                              value={h.ticker}
                              onChange={e => handleFieldChange(idx, "ticker", e.target.value.toUpperCase())}
                              style={{ width: "90px", height: "32px", padding: "0 8px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)", fontWeight: "600" }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              value={h.company}
                              onChange={e => handleFieldChange(idx, "company", e.target.value)}
                              style={{ width: "160px", height: "32px", padding: "0 8px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                            />
                          </td>
                          <td>
                            <select
                              value={h.sector}
                              onChange={e => handleFieldChange(idx, "sector", e.target.value)}
                              style={{ height: "32px", padding: "0 8px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)" }}
                            >
                              {SECTOR_OPTIONS.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={h.currentWeight}
                              onChange={e => handleWeightChange(idx, Number(e.target.value))}
                              style={{ width: "75px", height: "32px", padding: "0 8px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel-subtle)", color: "var(--text)", fontWeight: "600" }}
                            />
                            %
                          </td>
                          <td>₹{holdingValue.toFixed(1)} Cr</td>
                          <td>
                            <button
                              onClick={() => handleRemoveHolding(idx)}
                              style={{ background: "none", border: "none", color: "var(--negative)", cursor: "pointer", padding: "4px", display: "inline-flex", alignItems: "center" }}
                              title="Delete Holding"
                            >
                              <Icon name="close" size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Holding Row */}
            <div style={{ padding: "18px", borderTop: "1px solid var(--border)", background: "var(--panel-subtle)" }}>
              <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px", color: "var(--text)" }}>Add New Stock Holding</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="TICKER"
                  value={newTicker}
                  onChange={e => setNewTicker(e.target.value.toUpperCase())}
                  style={{ width: "110px", height: "38px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel)", color: "var(--text)", textTransform: "uppercase" }}
                />
                <input
                  type="text"
                  placeholder="Company Name"
                  value={newCompany}
                  onChange={e => setNewCompany(e.target.value)}
                  style={{ flex: "1 1 180px", height: "38px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel)", color: "var(--text)" }}
                />
                <select
                  value={newSector}
                  onChange={e => setNewSector(e.target.value)}
                  style={{ width: "150px", height: "38px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel)", color: "var(--text)" }}
                >
                  {SECTOR_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  placeholder="Weight %"
                  value={newWeight}
                  onChange={e => setNewWeight(Number(e.target.value))}
                  style={{ width: "100px", height: "38px", padding: "0 10px", borderRadius: "4px", border: "1px solid var(--border-strong)", background: "var(--panel)", color: "var(--text)" }}
                />
                <Button variant="secondary" onClick={handleAddHolding}>
                  Add Holding
                </Button>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Save & Instructions */}
        <aside className="control-panel">
          <PanelTitle title="Save Configuration" subtitle="Persist holdings to database" />
          <div style={{ padding: "18px 0" }}>
            <p style={{ fontSize: "13px", lineHeight: "1.55", color: "var(--secondary)", marginBottom: "18px" }}>
              Updating portfolio holdings and exposures dynamically adjusts both <strong>Index Allocation</strong> calculations and <strong>Portfolio Stress Testing</strong> models across the platform.
            </p>

            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Portfolio Setup"}
            </Button>
          </div>

          <div className="context-note" style={{ marginTop: "24px" }}>
            <strong>Domain Rules</strong>
            <ul style={{ paddingLeft: "16px", marginTop: "8px", fontSize: "12px", lineHeight: "1.6", color: "var(--secondary)" }}>
              <li><strong>Index Allocation:</strong> Operates strictly on configured stock holdings against the selected index universe ({indexUniverse}).</li>
              <li><strong>Stress Testing:</strong> Models full portfolio exposure (Loans: ₹{loansExposure}Cr, Bonds: ₹{bondsExposure}Cr, Derivatives: ₹{derivativesExposure}Cr, Equity: ₹{totalEquityExposure.toFixed(1)}Cr).</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
