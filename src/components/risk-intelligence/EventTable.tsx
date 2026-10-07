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
          {rows.map((event, index) => (
            <tr
              key={event.id || event.title}
              onClick={() => onSelect(index)}
              className={selected === index ? "selected-row" : ""}
            >
              <td>
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
              <td>{event.category}</td>
              <td>{event.entity}</td>
              <td>
                <span
                  className={event.sentiment >= 0 ? "positive" : "negative"}
                >
                  {event.sentiment > 0 ? "+" : ""}
                  {typeof event.sentiment === 'number' ? event.sentiment.toFixed(2) : event.sentiment}
                </span>
              </td>
              <td>
                <b>{typeof event.impact === 'number' ? event.impact.toFixed(1) : event.impact}</b>
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
                      event.impact >= 7
                        ? "stress-triggered"
                        : "stress-not-triggered"
                    }
                  >
                    {event.impact >= 7 && <Icon name="scenario" size={13} />}
                    {event.impact >= 7
                      ? "Stress test triggered"
                      : "— No trigger"}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
