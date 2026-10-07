import React, { useState, useEffect, useMemo } from "react"
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
import { PanelTitle } from "../common/PanelTitle"
import { Slider } from "../common/Slider"
import { Summary } from "../common/Summary"
import { PageHeading } from "../common/PageHeading"

export function EventTable({
  rows = [],
  onSelect,
  selected,
  showStressAction = false,
}: {
  rows?: any[]
  onSelect: (index: number) => void
  selected?: number | null
  showStressAction?: boolean
}) {
  return (
    <div className="table-wrap">
      <table className={showStressAction ? "stress-action-table" : ""}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Classification</th>
            <th>Entity</th>
            <th>Sentiment</th>
            <th>Impact</th>
            <th>Source</th>
            <th>Time</th>
            {showStressAction && <th>Stress action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((event, index) => {
            const numSentiment = typeof event.sentiment === 'number' ? event.sentiment : parseFloat(event.sentiment) || 0;
            const numImpact = typeof event.impact === 'number' ? event.impact : parseFloat(event.impact) || 0;
            const sentimentClass = numSentiment > 0 ? "positive" : numSentiment < 0 ? "negative" : "neutral";
            const sentimentStr = `${numSentiment > 0 ? "+" : ""}${numSentiment.toFixed(2)}`;
            const impactStr = `${numImpact.toFixed(1)} / 10`;

            return (
              <tr
                key={event.id || event.title || index}
                onClick={() => onSelect(index)}
                className={selected === index ? "selected-row" : ""}
              >
                <td title={event.title}>
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                      title="View original article"
                    >
                      <strong>{event.title}</strong>
                    </a>
                  ) : (
                    <strong>{event.title}</strong>
                  )}
                </td>
                <td title={event.category}>{event.category}</td>
                <td title={event.entity}>
                  <span className="entity-cell-text">{event.entity}</span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <span className={`sentiment-badge ${sentimentClass}`}>
                    {sentimentStr}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <b className="impact-badge">{impactStr}</b>
                </td>
                <td>
                  {event.url ? (
                    <a
                      href={event.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#3b82f6', textDecoration: 'none' }}
                    >
                      {event.source} ↗
                    </a>
                  ) : (
                    event.source
                  )}
                </td>
                <td>{event.time || event.date}</td>
                {showStressAction && (
                  <td>
                    <span
                      className={
                        numImpact >= 7
                          ? "stress-triggered"
                          : "stress-not-triggered"
                      }
                    >
                      {numImpact >= 7 && <Icon name="scenario" size={13} />}
                      {numImpact >= 7
                        ? "Triggered"
                        : "— No trigger"}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  )
}
