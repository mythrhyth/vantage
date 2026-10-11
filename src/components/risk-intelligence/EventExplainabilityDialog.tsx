import React, { useMemo } from "react"
import {
  Page,
  IconName,
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "../../types"

import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
  generateEventStressParameters,
  calculateScenarioLoss,
} from "../../utils"
import { Icon } from "../common/Icon"
import { Button } from "../common/Button"
import { ModalDialog } from "../common/ModalDialog"

export function EventExplainabilityDialog({
  event,
  onClose,
  onRunStressTest,
}: {
  event: any
  onClose: () => void
  onRunStressTest?: (event: any) => void
}) {
  if (!event) return null

  const numSentiment = typeof event.sentiment === "number" ? event.sentiment : parseFloat(event.sentiment) || 0
  const numImpact = typeof event.impact === "number" ? event.impact : parseFloat(event.impact) || 0
  const categoryStr = event.category || "General"
  const entityStr = event.entity || "Portfolio Entity"
  const sourceStr = event.source || "Market Data"
  const titleStr = event.title || "Risk Event"
  const dateStr = event.date || "Today"
  const timeStr = event.time || "Just now"

  const sentimentLabel = numSentiment >= 0 ? "Positive" : "Negative"
  const impactLabel =
    numImpact >= 8 ? "High" : numImpact >= 7 ? "Elevated" : "Moderate"
  const stressTriggered = numImpact >= 7
  const mappedScenario = mappedScenarioForEvent(categoryStr)
  
  const uniqueAssets = useMemo(() => {
    const list = Array.isArray(event.affectedAssets) ? event.affectedAssets : (Array.isArray(event.affected_assets) ? event.affected_assets : []);
    return Array.from(new Set(list.map((a: any) => String(a).trim()).filter(Boolean)));
  }, [event.affectedAssets, event.affected_assets]);

  return (
    <ModalDialog
      labelledBy="explainability-title"
      describedBy="explainability-description"
      className="event-explainability-dialog"
      onClose={onClose}
    >
        <div className="explainability-header">
          <div>
            <span className="dialog-eyebrow">Event explainability</span>
            <div className="dialog-title" id="explainability-title">
              {titleStr}
            </div>
            <span className="dialog-meta" id="explainability-description">
              {sourceStr} · {dateStr} at {timeStr}
            </span>
          </div>
          <Button
            variant="icon"
            icon="close"
            ariaLabel="Close event explainability"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="explainability-body">
          <section className="dialog-section snapshot-section">
            <div className="dialog-section-title">Event snapshot</div>
            <div className="snapshot-grid">
              <span>
                <small>Classification</small>
                <b>{titleCase(categoryStr)}</b>
              </span>
              <span>
                <small>Entity</small>
                <b>{titleCase(entityStr)}</b>
              </span>
              <span>
                <small>Sentiment</small>
                <b className={numSentiment >= 0 ? "positive" : "negative"}>
                  {numSentiment > 0 ? "+" : ""}
                  {numSentiment.toFixed(2)} / {sentimentLabel}
                </b>
              </span>
              <span>
                <small>Impact</small>
                <b>
                  {numImpact.toFixed(1)} / 10 / {impactLabel}
                </b>
              </span>
            </div>
          </section>

          <div className="event-integration-grid">
            <section className="dialog-section event-source-detail">
              <div className="dialog-section-title">Source visibility & Provenance</div>
              <span>
                <small>Primary source</small>
                <b>{sourceStr}</b>
              </span>
              <span>
                <small>Reporting sources count</small>
                <b className="positive">
                  {event.source_count || (event.additional_sources?.length ? event.additional_sources.length + 1 : 1)} source{(event.source_count || 1) > 1 ? 's' : ''} reporting this event
                </b>
              </span>
              {Array.isArray(event.additional_sources) && event.additional_sources.length > 0 && (
                <span>
                  <small>Also reported by</small>
                  <b>{event.additional_sources.map((s: any) => s.source || s.name).join(', ')}</b>
                </span>
              )}
              <span>
                <small>Timestamp</small>
                <b>{dateStr} at {timeStr}</b>
              </span>
            </section>
            <section className="dialog-section trigger-decision-card">
              <div className="dialog-section-title">Trigger decision</div>
              <div className="trigger-decision-metrics">
                <span>
                  <small>Impact score</small>
                  <b>{numImpact.toFixed(1)}</b>
                </span>
                <span>
                  <small>Trigger threshold</small>
                  <b>7.0</b>
                </span>
                <span>
                  <small>Status</small>
                  <b className={stressTriggered ? "positive" : ""}>
                    {stressTriggered ? "Stress test triggered" : "— No trigger"}
                  </b>
                </span>
              </div>
              <div className="trigger-scale">
                <i style={{ width: `${Math.min(100, Math.max(0, numImpact * 10))}%` }} />
                <b style={{ left: "70%" }} />
              </div>
              <div className="trigger-scale-labels">
                <span>{numImpact.toFixed(1)} / 10</span>
                <span>7.0 threshold</span>
              </div>
              <p>
                <strong>
                  Why was the stress test{" "}
                  {stressTriggered ? "triggered" : "not triggered"}?
                </strong>
                {stressTriggered
                  ? `Impact score exceeds the configured threshold of 7.0. The event is classified as a high-impact ${categoryStr.toLowerCase()} event.`
                  : `Impact score remains below the configured threshold of 7.0, so no automatic stress scenario was generated.`}
              </p>
            </section>
          </div>

          <section className="dialog-section event-stress-mapping">
            <div className="dialog-section-title">Event-to-Stress Mapping</div>
            <span className="mapping-origin">
              Generated from NLP Risk Engine output
            </span>
            <div className="event-mapping-flow">
              {[
                ["Detected event", titleStr],
                ["Event classification", titleCase(categoryStr)],
                ["Impact score", `${numImpact.toFixed(1)} / 10`],
                [
                  "Trigger rule",
                  `${numImpact.toFixed(1)} ${
                    stressTriggered ? "≥" : "<"
                  } 7.0`,
                ],
                [
                  "Stress scenario",
                  stressTriggered
                    ? mappedScenario
                    : `${mappedScenario} · analyst initiated`,
                ],
              ].map(([label, value], index) => (
                <div className="event-mapping-step" key={label}>
                  <span className="mapping-step-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="mapping-step-content">
                    <small>{label}</small>
                    <b>{value}</b>
                  </span>
                </div>
              ))}
            </div>
            <div className="generated-scenario-action">
              <span>
                <small>Suggested scenario</small>
                <b>{mappedScenario}</b>
                {!stressTriggered && (
                  <i>Available for analyst-initiated testing</i>
                )}
              </span>
            </div>
          </section>

          <div className="dialog-two-column">
            <section className="dialog-section">
              <div className="dialog-section-title">
                Why this classification?
              </div>
              <p>{event.classificationReason || "Classified automatically by NLP Risk Engine based on article key phrase extraction and market taxonomy."}</p>
              <div className="evidence-chips">
                {(Array.isArray(event.signals) ? event.signals : []).map((signal: any) => (
                  <span key={typeof signal === 'string' ? signal : JSON.stringify(signal)}>{typeof signal === 'string' ? signal : JSON.stringify(signal)}</span>
                ))}
              </div>
              {event.classificationConfidence !== undefined && (
                <div className="confidence-row">
                  <span>Classification confidence</span>
                  <b>{event.classificationConfidence}%</b>
                </div>
              )}
            </section>

            <section className="dialog-section">
              <div className="dialog-section-title">Why this sentiment?</div>
              <div className="score-line">
                <span>Sentiment score</span>
                <b className={numSentiment >= 0 ? "positive" : "negative"}>
                  {numSentiment > 0 ? "+" : ""}
                  {numSentiment.toFixed(2)}
                </b>
              </div>
              <div className="sentiment-scale">
                <i
                  className="sentiment-marker"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((numSentiment + 1) / 2) * 100))}%`,
                  }}
                />
              </div>
              <div className="sentiment-scale-labels">
                <span>-1 Negative</span>
                <span>0 Neutral</span>
                <span>+1 Positive</span>
              </div>
              <div className="driver-list">
                {(Array.isArray(event.sentimentDrivers) ? event.sentimentDrivers : []).map((driver: any) => {
                  const driverText = typeof driver === 'string' ? driver : (driver.text || driver.driver || JSON.stringify(driver));
                  return (
                    <span className="sentiment-driver" key={driverText}>
                      <b>{driverText}</b>
                      <small className={numSentiment >= 0 ? "positive" : "negative"}>
                        {sentimentLabel}
                      </small>
                    </span>
                  );
                })}
              </div>
              {event.sentimentConfidence !== undefined && (
                <div className="confidence-row">
                  <span>Sentiment confidence</span>
                  <b>{event.sentimentConfidence}%</b>
                </div>
              )}
            </section>
          </div>

          <div className="dialog-two-column impact-entities-grid">
            <section className="dialog-section">
              <div className="dialog-section-title">Why this impact?</div>
              <div className="score-line">
                <span>Impact score</span>
                <b>{numImpact.toFixed(1)} / 10</b>
              </div>
              <div className="factor-list">
                {(Array.isArray(event.impactFactors) ? event.impactFactors : []).map((item: any) => {
                  const factor = Array.isArray(item) ? item[0] : (item.factor || item.name || String(item));
                  const score = Array.isArray(item) ? item[1] : (item.score || 5);
                  return (
                    <div className="factor-row" key={factor}>
                      <span>{factor}</span>
                      <i>
                        <b style={{ width: `${Number(score) * 10}%` }} />
                      </i>
                      <strong>{score} / 10</strong>
                    </div>
                  );
                })}
              </div>
              <p>{event.impactReason || "Assessed based on entity exposure and potential market volatility."}</p>
              {event.impactConfidence !== undefined && (
                <div className="confidence-row">
                  <span>Impact confidence</span>
                  <b>{event.impactConfidence}%</b>
                </div>
              )}
            </section>

            <section className="dialog-section affected-section">
              <div className="dialog-section-title">Affected entities</div>
              <span className="entity-label">Primary affected entity</span>
              <strong className="primary-entity">
                {titleCase(entityStr)}
              </strong>
              <span className="entity-label secondary-label">
                Secondary affected areas
              </span>
              <div className="affected-list">
                {(Array.isArray(event.affectedAreas) ? event.affectedAreas : []).map((item: any) => {
                  const area = Array.isArray(item) ? item[0] : (item.area || item.name || String(item));
                  const level = Array.isArray(item) ? item[1] : (item.level || "Moderate");
                  return (
                    <span className="affected-area" key={area}>
                      <b>{area}</b>
                      <small className={level === "High" ? "risk" : ""}>
                        {level}
                      </small>
                    </span>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="dialog-two-column transmission-evidence-grid">
            <section className="dialog-section">
              <div className="dialog-section-title">Risk transmission</div>
              <div className="risk-flow">
                {(() => {
                  const flow = Array.isArray(event.riskFlow) ? event.riskFlow : [];
                  return flow.map((step: any, index: number) => {
                    const stepText = typeof step === 'string' ? step : (step.step || JSON.stringify(step));
                    return (
                      <div key={stepText}>
                        <span>{stepText}</span>
                        {index < flow.length - 1 && <i>↓</i>}
                      </div>
                    );
                  });
                })()}
              </div>
            </section>

            <section className="dialog-section">
              <div className="dialog-section-title">Evidence</div>
              <div className="evidence-source">
                <span>Source</span>
                <b>{sourceStr}</b>
              </div>
              <div className="source-excerpt">
                <span>
                  Evidence used for classification and risk assessment
                </span>
                <p>“{event.excerpt || "Market news report"}”</p>
              </div>
              {(event as any).url ? (
                <Button
                  onClick={() =>
                    window.open(
                      (event as any).url,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  View Source
                </Button>
              ) : (
                <div className="source-unavailable">
                  <strong>Source URL unavailable</strong>
                </div>
              )}
            </section>
          </div>

          <section className="dialog-section portfolio-section">
            <div className="dialog-section-title">Portfolio relevance</div>
            {event.relevanceType ? (
              <div className="portfolio-content">
              <div className="portfolio-field">
                <span className="portfolio-field-label">Relevance type</span>
                <strong className="portfolio-field-value">{titleCase(event.relevanceType)}</strong>
                </div>
                {event.relevanceScore !== null && event.relevanceScore !== undefined && (
                <div className="portfolio-field">
                  <span className="portfolio-field-label">Relevance score</span>
                  <strong className="portfolio-field-value">{Number(event.relevanceScore).toFixed(2)}</strong>
                  </div>
                )}
              <div className="portfolio-field portfolio-reason">
                <span className="portfolio-field-label">Relevance reason</span>
                <p>{event.relevanceReason || "No relevance explanation is available for this event."}</p>
                </div>
                {uniqueAssets.length > 0 && (
                <div className="portfolio-field portfolio-areas">
                  <span className="portfolio-field-label">Affected holdings</span>
                  <div className="portfolio-holdings">
                    {uniqueAssets.map((asset: string) => (
                      <span key={asset}>
                        <b>{asset}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            ) : (
            <div className="portfolio-unavailable" role="status">
              <strong>Relevance metadata unavailable</strong>
              <span>
                  No mapped holdings data is available for this event.
                </span>
              </div>
            )}
          </section>
        </div>

        <div className="explainability-footer">
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
          {onRunStressTest && (
            <Button onClick={() => onRunStressTest(event)}>
              Run Stress Test
            </Button>
          )}
        </div>
    </ModalDialog>
  )
}
