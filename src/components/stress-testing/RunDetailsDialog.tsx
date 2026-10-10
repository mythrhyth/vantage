import React, { useEffect } from "react"
import { StressTestHistoryEntry } from "../../types"
import { Button } from "../common/Button"

export function RunDetailsDialog({
  run,
  onClose,
}: {
  run: StressTestHistoryEntry
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  const params = run.parameters || {}
  const units = params.units || {
    rate: "bps",
    spread: "bps",
    inflation: "bps",
    liquidity: "%",
    probability: "%",
  }

  const baseline = run.baselineValue || 1000
  const loss = run.loss || run.absoluteLoss || 0
  const stressed = run.stressedValue || Math.max(0, baseline - loss)
  const lossPct = baseline > 0 ? (loss / baseline) * 100 : 0

  const paramKeys = Object.keys(params).filter(
    (k) => !["run_type", "parameter_source", "units", "scenario_name", "event_title"].includes(k)
  )

  const attribution = run.attributionResult?.factors || []
  const residual = run.attributionResult?.interaction_residual || 0

  return (
    <div
      className="explainability-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="explainability-dialog run-details-dialog"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: "680px" }}
      >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Stress Test Execution Audit</span>
            <div className="dialog-title">{run.displayTitle || run.scenario || "Stress Test Run Details"}</div>
            <span className="dialog-meta">
              Run ID: <code style={{ fontSize: "11px" }}>{run.runId || run.id}</code>
            </span>
          </div>
          <Button variant="icon" icon="close" onClick={onClose} aria-label="Close dialog" />
        </div>

        <div className="explainability-content" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Metadata Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
            <div className="metric-card">
              <span className="metric-label">Run Type</span>
              <strong style={{ fontSize: "14px", textTransform: "capitalize", color: "#4f46e5" }}>
                {run.run_type || run.parameterSource || "unknown"}
              </strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Portfolio</span>
              <strong style={{ fontSize: "13px" }}>{run.portfolio_name || "Primary Portfolio"}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Executed At</span>
              <strong style={{ fontSize: "13px" }}>{run.completedAt || "Recently"}</strong>
            </div>
          </div>

          {/* Results Summary */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "14px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "8px" }}>
              FINANCIAL ENGINE IMPACT
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Baseline Value</span>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>₹{baseline.toFixed(1)} Cr</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Stressed Value</span>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>₹{stressed.toFixed(1)} Cr</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Net Calculated Loss</span>
                <div style={{ fontSize: "16px", fontWeight: 700, color: loss > 0 ? "#dc2626" : "#16a34a" }}>
                  -₹{loss.toFixed(1)} Cr ({lossPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          </div>

          {/* Parameters Used */}
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
              Stress Parameters & Units
            </div>
            {paramKeys.length > 0 ? (
              <table className="scenario-table" style={{ width: "100%", fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {paramKeys.map((k) => (
                    <tr key={k}>
                      <td><strong>{k.replace(/_/g, " ").toUpperCase()}</strong></td>
                      <td>{String(params[k])}</td>
                      <td>{units[k] || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <span style={{ fontSize: "12px", color: "#64748b" }}>No custom parameters recorded (Default baseline)</span>
            )}
          </div>

          {/* Factor Loss Attribution */}
          {attribution.length > 0 && (
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "8px" }}>
                Factor Loss Attribution Breakdown
              </div>
              <table className="scenario-table" style={{ width: "100%", fontSize: "12px" }}>
                <thead>
                  <tr>
                    <th>Risk Factor</th>
                    <th>Attributed Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {attribution.map((f: any) => (
                    <tr key={f.factor}>
                      <td>{f.factor.replace(/_/g, " ").toUpperCase()}</td>
                      <td style={{ color: f.loss > 0 ? "#dc2626" : "#475569" }}>
                        ₹{Number(f.loss).toFixed(2)} Cr
                      </td>
                    </tr>
                  ))}
                  {residual > 0 && (
                    <tr>
                      <td>INTERACTION RESIDUAL</td>
                      <td style={{ color: "#dc2626" }}>₹{Number(residual).toFixed(2)} Cr</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="explainability-footer" style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </section>
    </div>
  )
}
