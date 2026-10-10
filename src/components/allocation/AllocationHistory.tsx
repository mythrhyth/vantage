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
export function computeAggregateWeights(assets: Asset[] = [], proposed: number[] = []) {
  if (!assets || assets.length === 0) {
    return { techWeight: 19.82, finWeight: 6.21 }
  }

  let techSum = 0
  let finSum = 0

  assets.forEach((a, idx) => {
    const s = (a.sector || "").toLowerCase()
    const weight =
      proposed && proposed[idx] !== undefined && proposed[idx] !== null
        ? Number(proposed[idx]) || 0
        : Number(a.current) || 0

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

export function AllocationHistory({
  sensitivity = 50,
  assets = [],
  proposed = [],
  isLoading = false,
  isError = false,
}: AllocationHistoryProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [containerWidth, setContainerWidth] = useState<number>(800)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width for responsive tick density and layout
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

  // Compute aggregate weights for Technology and Financials
  const { techWeight, finWeight } = useMemo(
    () => computeAggregateWeights(assets, proposed),
    [assets, proposed]
  )

  // Construct 12-month historical series
  const historyData = useMemo(
    () => generateHistorySeries(techWeight, finWeight, sensitivity),
    [techWeight, finWeight, sensitivity]
  )

  const latest = historyData[historyData.length - 1]
  const initial = historyData[0]
  const tech12mChange = parseFloat((latest.tech - initial.tech).toFixed(2))
  const fin12mChange = parseFloat((latest.fin - initial.fin).toFixed(2))

  // Y-axis bounds & dynamic ticks
  const { maxY, yTicks } = useMemo(() => {
    let max = 0
    historyData.forEach((d) => {
      if (d.tech > max) max = d.tech
      if (d.fin > max) max = d.fin
    })
    const ceiling = Math.max(25, Math.ceil((max + 3) / 5) * 5)
    const step = ceiling / 5
    const ticks = [
      ceiling,
      ceiling - step,
      ceiling - 2 * step,
      ceiling - 3 * step,
      ceiling - 4 * step,
      0,
    ]
    return { maxY: ceiling, yTicks: ticks }
  }, [historyData])

  // SVG dimensions & scales
  const svgWidth = 800
  const svgHeight = 220
  const plotLeft = 45
  const plotRight = 775
  const plotTop = 20
  const plotBottom = 180
  const plotWidth = plotRight - plotLeft
  const plotHeight = plotBottom - plotTop

  const getX = (i: number) => plotLeft + i * (plotWidth / 11)
  const getY = (val: number) => plotBottom - (val / maxY) * plotHeight

  const techPoints = historyData.map((d, i) => ({
    x: getX(i),
    y: getY(d.tech),
  }))
  const finPoints = historyData.map((d, i) => ({
    x: getX(i),
    y: getY(d.fin),
  }))

  const getSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return ""
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cur = pts[i]
      const nxt = pts[i + 1]
      const cX = (cur.x + nxt.x) / 2
      path += ` C ${cX.toFixed(1)} ${cur.y.toFixed(1)}, ${cX.toFixed(
        1
      )} ${nxt.y.toFixed(1)}, ${nxt.x.toFixed(1)} ${nxt.y.toFixed(1)}`
    }
    return path
  }

  const techPath = getSmoothPath(techPoints)
  const finPath = getSmoothPath(finPoints)

  const activeIndex = hoverIndex !== null ? hoverIndex : 11
  const activePoint = historyData[activeIndex]
  const activeX = getX(activeIndex)

  // Visible x-axis ticks based on container width
  const visibleTickIndices = useMemo(
    () => getResponsiveTickIndices(containerWidth, historyData.length),
    [containerWidth, historyData.length]
  )

  if (isLoading) {
    return (
      <section className="line-chart-panel">
        <PanelTitle
          title="Historical allocation trend"
          subtitle="12 months · Simulated baseline"
        />
        <div className="trend-chart-skeleton">
          <div className="skeleton-line" />
          <span>Loading historical allocation trend...</span>
        </div>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="line-chart-panel">
        <PanelTitle
          title="Historical allocation trend"
          subtitle="12 months · Simulated baseline"
        />
        <div className="trend-chart-error">
          <span>Unable to load historical allocation trend</span>
        </div>
      </section>
    )
  }

  return (
    <section className="line-chart-panel" ref={containerRef}>
      <PanelTitle
        title="Historical allocation trend"
        subtitle="12 months · Simulated baseline"
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
                  className={`trend-metric-change ${
                    tech12mChange >= 0 ? "positive" : "negative"
                  }`}
                >
                  {tech12mChange >= 0
                    ? `+${tech12mChange.toFixed(1)}%`
                    : `${tech12mChange.toFixed(1)}%`}
                  <small className="trend-metric-period"> 12m</small>
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
                  className={`trend-metric-change ${
                    fin12mChange >= 0 ? "positive" : "negative"
                  }`}
                >
                  {fin12mChange >= 0
                    ? `+${fin12mChange.toFixed(1)}%`
                    : `${fin12mChange.toFixed(1)}%`}
                  <small className="trend-metric-period"> 12m</small>
                </span>
              </div>
            </div>
          </div>
        }
      />

      <div className="trend-chart-wrapper">
        <svg
          className="trend-chart-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
        >
          {/* Subtle Horizontal Gridlines & Y-Axis Ticks */}
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

          {/* Active Vertical Crosshair */}
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

          {/* Series Lines */}
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

          {/* Minimal Endpoint Dots (Latest Values) & Hover Dots */}
          {historyData.map((d, i) => {
            const isHovered = i === hoverIndex
            const isEnd = i === 11
            if (!isHovered && !isEnd) return null

            const x = getX(i)
            const yTech = getY(d.tech)
            const yFin = getY(d.fin)

            return (
              <g key={`dots-${i}`}>
                {/* Tech point */}
                <circle
                  cx={x}
                  cy={yTech}
                  r={isHovered ? 5.5 : 3.5}
                  fill="var(--accent)"
                  stroke="var(--panel)"
                  strokeWidth={isHovered ? 2 : 1.5}
                />
                {/* Fin point */}
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

          {/* Responsive X-Axis Month Labels */}
          {visibleTickIndices.map((i) => {
            const d = historyData[i]
            const x = getX(i)
            let anchor: "start" | "middle" | "end" = "middle"
            if (i === 0) anchor = "start"
            if (i === 11) anchor = "end"
            const isActive = i === activeIndex && hoverIndex !== null

            return (
              <text
                key={`month-tick-${i}`}
                x={x}
                y={plotBottom + 20}
                textAnchor={anchor}
                fill={isActive ? "var(--text)" : "var(--secondary)"}
                fontSize="11"
                fontWeight={isActive ? "600" : "400"}
              >
                {d.month}
              </text>
            )
          })}

          {/* Interactive Touch / Mouse Hover Overlay Strips */}
          {historyData.map((_, i) => {
            const x = getX(i)
            const w = plotWidth / 11
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

        {/* Clean Interactive Hover Tooltip */}
        {hoverIndex !== null && activePoint && (
          <div
            className="trend-tooltip"
            style={{
              top: "12px",
              left: `${(activeX / svgWidth) * 100}%`,
              transform:
                activeIndex > 7
                  ? "translateX(calc(-100% - 10px))"
                  : "translateX(10px)",
            }}
          >
            <div className="trend-tooltip-title">
              <span>{activePoint.month}</span>
              {activePoint.isLatest && (
                <span className="tooltip-badge">Current</span>
              )}
            </div>
            <div className="trend-tooltip-row">
              <div className="label-wrap">
                <span className="legend-dot tech" />
                <span>Technology</span>
              </div>
              <div className="val-wrap">
                <span className="val">{activePoint.tech.toFixed(1)}%</span>
                {activeIndex > 0 && (
                  <small
                    className={`mom ${
                      activePoint.techMom >= 0 ? "positive" : "negative"
                    }`}
                  >
                    ({activePoint.techMom >= 0 ? "+" : ""}
                    {activePoint.techMom.toFixed(1)}%)
                  </small>
                )}
              </div>
            </div>
            <div className="trend-tooltip-row">
              <div className="label-wrap">
                <span className="legend-dot fin" />
                <span>Financials</span>
              </div>
              <div className="val-wrap">
                <span className="val">{activePoint.fin.toFixed(1)}%</span>
                {activeIndex > 0 && (
                  <small
                    className={`mom ${
                      activePoint.finMom >= 0 ? "positive" : "negative"
                    }`}
                  >
                    ({activePoint.finMom >= 0 ? "+" : ""}
                    {activePoint.finMom.toFixed(1)}%)
                  </small>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
