import React, { useState } from "react"
import { Button } from "../common/Button"
import { ModalDialog } from "./ModalDialog"

export function SettingsPanel({
  dark,
  setDark,
  onClose,
}: {
  dark: boolean
  setDark: (dark: boolean) => void
  onClose: () => void
}) {
  const [density, setDensity] = useState("Comfortable")
  const [currency, setCurrency] = useState("INR")
  const [alerts, setAlerts] = useState(true)

  return (
    <ModalDialog
      className="settings-drawer"
      labelledBy="settings-title"
      describedBy="settings-description"
      onClose={onClose}
      variant="drawer"
    >
      <div className="settings-head">
        <div>
          <strong id="settings-title">Settings</strong>
          <span id="settings-description">Workspace preferences</span>
        </div>
        <Button
          variant="icon"
          icon="close"
          ariaLabel="Close settings"
          onClick={onClose}
        >
          Close
        </Button>
      </div>
      <div className="settings-drawer-body">
        <div className="settings-section">
          <span className="settings-section-title">Appearance</span>
          <div className="settings-row">
            <span>
              <b>Dark theme</b>
              <small>Use the dark analytical workspace</small>
            </span>
            <button
              className={`switch ${dark ? "active" : ""}`}
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark theme"
            >
              <i />
            </button>
          </div>
          <label className="field-label">
            <span>Interface density</span>
            <select
              value={density}
              onChange={(event) => setDensity(event.target.value)}
            >
              <option>Comfortable</option>
              <option>Compact</option>
            </select>
          </label>
        </div>
        <div className="settings-section">
          <span className="settings-section-title">Financial display</span>
          <label className="field-label">
            <span>Reporting currency</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              <option>INR</option>
              <option>USD</option>
              <option>EUR</option>
            </select>
          </label>
          <div className="settings-row">
            <span>
              <b>High-impact event alerts</b>
              <small>Show alerts above an impact score of 8</small>
            </span>
            <button
              className={`switch ${alerts ? "active" : ""}`}
              onClick={() => setAlerts(!alerts)}
              aria-label="Toggle event alerts"
            >
              <i />
            </button>
          </div>
        </div>
        <div className="settings-section">
          <span className="settings-section-title">Model information</span>
          <div className="model-info">
            <span>
              <small>Risk model</small>
              <b>VANTAGE Risk Model v2.4</b>
            </span>
            <span>
              <small>Valuation date</small>
              <b>21 June 2025</b>
            </span>
          </div>
        </div>
      </div>
      <div className="settings-drawer-footer">
        <Button onClick={onClose}>Save preferences</Button>
      </div>
    </ModalDialog>
  )
}
