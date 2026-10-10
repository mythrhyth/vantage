import React, { useState, useMemo, useRef, useEffect } from "react"
import { PanelTitle } from "../common/PanelTitle"

export interface Asset {
  company?: string
  ticker?: string
  current?: number
  sentiment?: number
  sector?: string
}

export interface AllocationHistoryProps {
  sensitivity?: number
  assets?: Asset[]
  proposed?: number[]
  isLoading?: boolean
  isError?: boolean
}

/**
 * Helper to compute responsive x-axis tick indices based on container width.
 * Returns array of month indices to render on the X-axis.
 */
export function getResponsiveTickIndices(containerWidth: number, totalMonths: number = 12): number[] {
  if (containerWidth < 480) {
    // Narrow mobile: show 5 ticks
    return [0, 3, 6, 9, 11]
  } else if (containerWidth < 680) {
    // Medium tablet: show alternating months + last month
    return [0, 2, 4, 6, 8, 10, 11]
  }
  // Desktop: show all 12 months
  return Array.from({ length: totalMonths }, (_, i) => i)
}

/**
 * Helper to compute aggregate weights for Technology and Financials.
 */
export function computeAggregateWeights(assets: Asset[] = [], proposed: number[] | Record<string, any> = []) {
  if (!assets || assets.length === 0) {
    return { techWeight: 19.82, finWeight: 6.21 }
  }

  let techSum = 0
  let finSum = 0

  assets.forEach((a, idx) => {
    const s = (a.sector || "").toLowerCase()
    let weight = Number(a.current) || 0

    if (proposed) {
      if (Array.isArray(proposed) && proposed[idx] !== undefined && proposed[idx] !== null) {
        weight = Number(proposed[idx]) || 0
      } else if (!Array.isArray(proposed) && a.ticker) {
        const tick = a.ticker.toUpperCase()
        const pInfo = (proposed as Record<string, any>)[tick] || (proposed as Record<string, any>)[a.ticker]
        if (pInfo && typeof pInfo.proposedWeight === "number") {
          weight = pInfo.proposedWeight
        }
      }
    }

    if (s.includes("tech")) {
      techSum += weight
    } else if (s.includes("finan") || s.includes("bank")) {
      finSum += weight
    }
  })

  return {
    techWeight: techSum > 0 ? parseFloat(techSum.toFixed(2)) : 19.82,
    finWeight: finSum > 0 ? parseFloat(finSum.toFixed(2)) : 6.21,
  }
}

/**
 * Helper to generate 12-month historical data series.
 */
export function generateHistorySeries(techWeight: number, finWeight: number, sensitivity: number = 50) {
  const sensOffset = (sensitivity - 50) / 30
  const monthNames = [
    "Jul 25",
    "Aug 25",
    "Sep 25",
    "Oct 25",
    "Nov 25",
    "Dec 25",
    "Jan 26",
    "Feb 26",
    "Mar 26",
    "Apr 26",
    "May 26",
    "Jun 26",
  ]

  const techRelOffsets = [
    -3.4, -2.8, -1.9, -2.2, -1.1, -1.5, +0.2, -0.4, +0.6, +0.1, +0.8, 0,
  ]
  const finRelOffsets = [
    +1.2, +0.9, +1.5, +0.7, +0.3, -0.2, -0.4, +0.3, -0.5, -0.8, -0.4, 0,
  ]

  return monthNames.map((month, i) => {
    const isLatest = i === monthNames.length - 1
    const progress = i / 11

    const rawTech = isLatest
      ? techWeight
      : Math.max(1.0, techWeight + techRelOffsets[i] + sensOffset * progress)

    const rawFin = isLatest
      ? finWeight
      : Math.max(
          1.0,
          finWeight + finRelOffsets[i] - sensOffset * 0.5 * progress
        )

    const techVal = parseFloat(rawTech.toFixed(2))
    const finVal = parseFloat(rawFin.toFixed(2))

    const prevTech =
      i > 0
        ? Math.max(
            1.0,
            techWeight +
              techRelOffsets[i - 1] +
              sensOffset * ((i - 1) / 11)
          )
        : techVal
    const prevFin =
      i > 0
        ? Math.max(
            1.0,
            finWeight +
              finRelOffsets[i - 1] -
              sensOffset * 0.5 * ((i - 1) / 11)
          )
        : finVal

    const techMom = i > 0 ? parseFloat((techVal - prevTech).toFixed(2)) : 0
    const finMom = i > 0 ? parseFloat((finVal - prevFin).toFixed(2)) : 0

    return {
      month,
      tech: techVal,
      fin: finVal,
      techMom,
      finMom,
      isLatest,
    }
  })
}

export interface HistoricalRunRecord {
  id: string
  timestamp: string
  sensitivity: number
  maxWeight: number
  maxChange: number
  sectorLimit: number;
  frequency: string
  transactionCostBps: number
  turnover: number
  transactionCostVal: number
  isSimulated: boolean
  isApplied: boolean
  items: any[]
}

export interface AllocationHistoryProps {
  portfolioId?: string | null
  sensitivity?: number
  assets?: Asset[]
  proposed?: number[] | Record<string, any>
  historyRuns?: HistoricalRunRecord[]
  isLoading?: boolean
  isError?: boolean
}

export function AllocationHistory({
  portfolioId,
  sensitivity = 50,
  assets = [],
  proposed = [],
  historyRuns = [],
  isLoading = false,
  isError = false,
}: AllocationHistoryProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width)
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Process historical series from real DB runs if available
  const historyData = useMemo(() => {
    if (historyRuns && historyRuns.length > 0) {
      // Sort chronologically ascending
      const sorted = [...historyRuns].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      return sorted.map((run, i) => {
        const dateObj = new Date(run.timestamp)
        const timeStr = `${dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ${dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}`

        let techSum = 0
        let finSum = 0
        const items = Array.isArray(run.items) ? run.items : []
        items.forEach((item: any) => {
          const sec = (item.sector || "").toLowerCase()
          const w = Number(item.proposedWeight ?? item.proposed_weight ?? item.currentWeight ?? 0)
          if (sec.includes("tech")) techSum += w
          if (sec.includes("finan") || sec.includes("bank")) finSum += w
        })

        const techVal = parseFloat(techSum.toFixed(2))
        const finVal = parseFloat(finSum.toFixed(2))
        const prevRun = i > 0 ? sorted[i - 1] : null

        let prevTech = techVal
        let prevFin = finVal
        if (prevRun) {
          let pTech = 0
          let pFin = 0
          const pItems = Array.isArray(prevRun.items) ? prevRun.items : []
          pItems.forEach((item: any) => {
            const sec = (item.sector || "").toLowerCase()
            const w = Number(item.proposedWeight ?? item.proposed_weight ?? item.currentWeight ?? 0)
            if (sec.includes("tech")) pTech += w
            if (sec.includes("finan") || sec.includes("bank")) pFin += w
          })
          prevTech = pTech
          prevFin = pFin
        }

        return {
          id: run.id,
          month: timeStr,
          tech: techVal,
          fin: finVal,
          techMom: i > 0 ? parseFloat((techVal - prevTech).toFixed(2)) : 0,
          finMom: i > 0 ? parseFloat((finVal - prevFin).toFixed(2)) : 0,
          turnover: Number(run.turnover || 0),
          costVal: Number(run.transactionCostVal || 0),
          isApplied: run.isApplied,
          isSimulated: run.isSimulated,
          isLatest: i === sorted.length - 1
        }
      })
    }

    // Fallback if no runs persisted yet: compute baseline point from current assets
    const { techWeight, finWeight } = computeAggregateWeights(assets, proposed)
    return [
      {
        id: 'current',
        month: 'Current Baseline',
        tech: techWeight,
        fin: finWeight,
        techMom: 0,
        finMom: 0,
        turnover: 0,
        costVal: 0,
        isApplied: true,
        isSimulated: false,
        isLatest: true
      }
    ]
  }, [historyRuns, assets, proposed])

  const latest = historyData[historyData.length - 1]
  const initial = historyData[0]
  const techChange = parseFloat((latest.tech - initial.tech).toFixed(2))
  const finChange = parseFloat((latest.fin - initial.fin).toFixed(2))

  const { maxY, yTicks } = useMemo(() => {
    let max = 0
    historyData.forEach((d) => {
      if (d.tech > max) max = d.tech
      if (d.fin > max) max = d.fin
    })
    const ceiling = Math.max(25, Math.ceil((max + 5) / 5) * 5)
    const step = ceiling / 5
    const ticks = [ceiling, ceiling - step, ceiling - 2 * step, ceiling - 3 * step, ceiling - 4 * step, 0]
    return { maxY: ceiling, yTicks: ticks }
  }, [historyData])

  const svgWidth = 800
  const svgHeight = 220
  const plotLeft = 55
  const plotRight = 765
  const plotTop = 20
  const plotBottom = 180
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  const getX = (i: number) => {
    if (historyData.length === 1) return (plotLeft + plotRight) / 2
    return plotLeft + i * (plotWidth / (historyData.length - 1))
  }
  const getY = (val: number) => plotBottom - (val / maxY) * plotHeight

  const techPoints = historyData.map((d, i) => ({ x: getX(i), y: getY(d.tech) }))
  const finPoints = historyData.map((d, i) => ({ x: getX(i), y: getY(d.fin) }))

  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ""
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cur = pts[i]
      const nxt = pts[i + 1]
      const cX = (cur.x + nxt.x) / 2
      path += ` C ${cX.toFixed(1)} ${cur.y.toFixed(1)}, ${cX.toFixed(1)} ${nxt.y.toFixed(1)}, ${nxt.x.toFixed(1)} ${nxt.y.toFixed(1)}`
    }
    return path
  }

  const techPath = getSmoothPath(techPoints)
  const finPath = getSmoothPath(finPoints)

  const activeIndex = hoverIndex !== null ? hoverIndex : historyData.length - 1
  const activePoint = historyData[activeIndex] || latest
  const activeX = getX(activeIndex)

  if (isLoading) {
    return (
      <section className="line-chart-panel">
        <PanelTitle
          title="Historical allocation trend"
          subtitle="Persisted rebalancing runs from database"
        />
        <div className="trend-chart-skeleton">
          <div className="skeleton-line" />
          <span>Loading historical allocation runs...</span>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="line-chart-panel">
        <PanelTitle
          title="Historical allocation trend"
          subtitle="Persisted rebalancing runs from database"
        />
        <div className="trend-chart-error">
          <span>Unable to retrieve historical allocation runs</span>
        </div>
      </section>
    )
  }

  const isSinglePoint = historyData.length === 1

  return (
    <section className="line-chart-panel" ref={containerRef}>
      <PanelTitle
        title="Historical allocation trend"
        subtitle={historyRuns.length > 0 ? `${historyRuns.length} persisted rebalancing runs` : "Baseline allocation state"}
        side={
          <div className="trend-metrics-strip">
            <div className="trend-metric-badge">
              <div className="trend-metric-header">
                <span className="legend-dot tech" />
                <span className="trend-metric-label">Technology</span>
              </div>
              <div className="trend-metric-values">
                <strong className="trend-metric-current">
                  {latest.tech.toFixed(1)}%
                </strong>
                <span
                  className={`trend-metric-change ${techChange >= 0 ? "positive" : "negative"}`}
                >
                  {techChange >= 0 ? `+${techChange.toFixed(1)}%` : `${techChange.toFixed(1)}%`}
                </span>
              </div>
            </div>

            <div className="trend-metric-badge">
              <div className="trend-metric-header">
                <span className="legend-dot fin" />
                <span className="trend-metric-label">Financials</span>
              </div>
              <div className="trend-metric-values">
                <strong className="trend-metric-current">
                  {latest.fin.toFixed(1)}%
                </strong>
                <span
                  className={`trend-metric-change ${finChange >= 0 ? "positive" : "negative"}`}
                >
                  {finChange >= 0 ? `+${finChange.toFixed(1)}%` : `${finChange.toFixed(1)}%`}
                </span>
              </div>
            </div>
          </div>
        }
      />

      <div className="trend-chart-wrapper">
        {historyRuns.length === 0 && (
          <div className="history-empty-banner" style={{ margin: "8px 16px", padding: "8px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.03)", border: "1px dashed var(--border)", fontSize: "12px", color: "var(--secondary)" }}>
            ℹ️ <strong>Persisted Run History:</strong> Recalculate or Apply allocations to record persistent historical rebalancing runs.
          </div>
        )}

        <svg
          className="trend-chart-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {yTicks.map((tick, i) => {
            const y = getY(tick)
            return (
              <g key={`y-tick-${i}`}>
                <line
                  x1={plotLeft}
                  y1={y}
                  x2={plotRight}
                  y2={y}
                  stroke="var(--border)"
                  strokeDasharray="4 4"
                  strokeWidth="0.8"
                  opacity="0.45"
                />
                <text
                  x={plotLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="var(--secondary)"
                  fontSize="11"
                  fontWeight="400"
                >
                  {Math.round(tick)}%
                </text>
              </g>
            )
          })}

          {hoverIndex !== null && (
            <line
              x1={activeX}
              y1={plotTop}
              x2={activeX}
              y2={plotBottom}
              stroke="var(--accent)"
              strokeDasharray="3 3"
              strokeWidth="1"
              opacity="0.5"
            />
          )}

          {!isSinglePoint && (
            <>
              <path
                d={techPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={finPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}

          {historyData.map((d, i) => {
            const x = getX(i)
            const yTech = getY(d.tech)
            const yFin = getY(d.fin)
            const isHovered = i === hoverIndex || isSinglePoint

            return (
              <g key={`dots-${i}`}>
                <circle
                  cx={x}
                  cy={yTech}
                  r={isHovered ? 5.5 : 3.5}
                  fill="var(--accent)"
                  stroke="var(--panel)"
                  strokeWidth={isHovered ? 2 : 1.5}
                />
                <circle
                  cx={x}
                  cy={yFin}
                  r={isHovered ? 5.5 : 3.5}
                  fill="#38bdf8"
                  stroke="var(--panel)"
                  strokeWidth={isHovered ? 2 : 1.5}
                />
              </g>
            )
          })}

          {historyData.map((d, i) => {
            const x = getX(i)
            const isActive = i === activeIndex
            return (
              <text
                key={`month-tick-${i}`}
                x={x}
                y={plotBottom + 20}
                textAnchor={isSinglePoint ? "middle" : i === 0 ? "start" : i === historyData.length - 1 ? "end" : "middle"}
                fill={isActive ? "var(--text)" : "var(--secondary)"}
                fontSize="11"
                fontWeight={isActive ? "600" : "400"}
              >
                {d.month}
              </text>
            )
          })}

          {historyData.map((_, i) => {
            const x = getX(i)
            const w = isSinglePoint ? plotWidth : plotWidth / Math.max(1, historyData.length - 1)
            return (
              <rect
                key={`hover-strip-${i}`}
                x={x - w / 2}
                y={plotTop}
                width={w}
                height={plotHeight + 25}
                fill="transparent"
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverIndex(i)}
              />
            )
          })}
        </svg>

        {hoverIndex !== null && activePoint && (
          <div
            className="trend-tooltip"
            style={{
              top: "12px",
              left: `${(activeX / svgWidth) * 100}%`,
              transform: activeIndex > Math.floor(historyData.length / 2) ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
            }}
          >
            <div className="trend-tooltip-title" style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span>{activePoint.month}</span>
              <span className={`tooltip-badge ${activePoint.isApplied ? "applied" : "simulated"}`} style={{ fontSize: "10px", padding: "1px 4px", borderRadius: "3px", background: activePoint.isApplied ? "var(--positive)" : "var(--accent)", color: "#fff" }}>
                {activePoint.isApplied ? "Applied Run" : "Simulated"}
              </span>
            </div>
            <div className="trend-tooltip-row">
              <div className="label-wrap">
                <span className="legend-dot tech" />
                <span>Technology</span>
              </div>
              <div className="val-wrap">
                <span className="val">{activePoint.tech.toFixed(1)}%</span>
              </div>
            </div>
            <div className="trend-tooltip-row">
              <div className="label-wrap">
                <span className="legend-dot fin" />
                <span>Financials</span>
              </div>
              <div className="val-wrap">
                <span className="val">{activePoint.fin.toFixed(1)}%</span>
              </div>
            </div>
            {activePoint.turnover > 0 && (
              <div className="trend-tooltip-row" style={{ fontSize: "10px", color: "var(--secondary)", marginTop: "4px", paddingTop: "4px", borderTop: "1px stroke var(--border)" }}>
                <span>Turnover: {activePoint.turnover.toFixed(2)}% (${activePoint.costVal.toFixed(2)} cost)</span>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

