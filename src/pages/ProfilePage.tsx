import React, { useState, useEffect, useMemo } from "react"
import {
  Page,
  IconName,
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "../types"
import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
  generateEventStressParameters,
  calculateScenarioLoss,
} from "../utils"
import { Icon } from "../components/common/Icon"
import { VantageLogo } from "../components/common/VantageLogo"
import { Button } from "../components/common/Button"
import { Slider } from "../components/common/Slider"
import { Summary } from "../components/common/Summary"
import { PanelTitle } from "../components/common/PanelTitle"
import { PageHeading } from "../components/common/PageHeading"
import { SettingsPanel } from "../components/common/SettingsPanel"
import { RiskHistogram } from "../components/risk-intelligence/RiskHistogram"
import { EventTable } from "../components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "../components/risk-intelligence/EventExplainabilityDialog"
import { MiniDistribution } from "../components/risk-intelligence/MiniDistribution"
import { AllocationChart } from "../components/allocation/AllocationChart"
import { AllocationHistory } from "../components/allocation/AllocationHistory"
import { AllocationExplanationDialog } from "../components/allocation/AllocationExplanationDialog"
import { OverallAllocationDialog } from "../components/allocation/OverallAllocationDialog"
import { AssetLossDialog } from "../components/stress-testing/AssetLossDialog"
import { WhyLossDialog } from "../components/stress-testing/WhyLossDialog"
import { EventStressComparisonDialog } from "../components/stress-testing/EventStressComparisonDialog"
import { ScenarioComparisonDialog } from "../components/scenario-analysis/ScenarioComparisonDialog"

export function ProfilePage({
  openSettings,
  onLogout,
}: {
  openSettings: () => void
  onLogout: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [name, setName] = useState("Arjun Rao")
  const [title, setTitle] = useState("Senior Risk Analyst")
  const [email, setEmail] = useState("arjun.rao@vantage.in")
  return (
    <div className="page profile-page">
      <section className="profile-hero">
        <span className="profile-avatar profile-page-avatar">AR</span>
        <div>
          <span>ANALYST PROFILE</span>
          <strong>{name}</strong>
          <small>{title} · Enterprise Risk</small>
        </div>
        <Button
          variant="text"
          onClick={() => {
            setEditing(!editing)
            setSaved(false)
          }}
        >
          {editing ? "Cancel editing" : "Edit profile"}
        </Button>
      </section>
      <div className="profile-page-grid">
        <section className="profile-details-panel">
          <PanelTitle
            title="Profile details"
            subtitle="Personal and professional information"
          />
          <div className="profile-form">
            <label>
              <span>Full name</span>
              <input
                value={name}
                disabled={!editing}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>Role</span>
              <input
                value={title}
                disabled={!editing}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              <span>Email address</span>
              <input
                value={email}
                disabled={!editing}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              <span>Team</span>
              <input value="Enterprise Risk" disabled />
            </label>
            <label>
              <span>Location</span>
              <input value="Mumbai, India" disabled />
            </label>
            <label>
              <span>Time zone</span>
              <input value="India Standard Time (UTC +5:30)" disabled />
            </label>
          </div>
          {editing && (
            <div className="profile-form-actions">
              <Button
                onClick={() => {
                  setEditing(false)
                  setSaved(true)
                }}
              >
                Save profile
              </Button>
              {saved && <span>Profile updated</span>}
            </div>
          )}
          {!editing && saved && (
            <div className="save-confirmation">Profile details were saved.</div>
          )}
        </section>
        <aside className="profile-side">
          <section>
            <PanelTitle title="Workspace access" />
            <dl>
              <div>
                <dt>Access level</dt>
                <dd>Senior analyst</dd>
              </div>
              <div>
                <dt>Portfolio scope</dt>
                <dd>Banking Demo Portfolio</dd>
              </div>
              <div>
                <dt>Last sign-in</dt>
                <dd>Today, 09:12 IST</dd>
              </div>
              <div>
                <dt>Session status</dt>
                <dd className="positive">Active</dd>
              </div>
            </dl>
          </section>
          <section className="profile-actions-panel">
            <PanelTitle
              title="Account actions"
              subtitle="Manage workspace and session"
            />
            <button onClick={openSettings}>
              <Icon name="settings" size={16} />
              <span>
                <b>Workspace settings</b>
                <small>Theme, currency and analysis preferences</small>
              </span>
            </button>
            <button className="logout-action" onClick={onLogout}>
              <Icon name="user" size={16} />
              <span>
                <b>Log out</b>
                <small>End the current analyst session</small>
              </span>
            </button>
          </section>
        </aside>
      </div>
    </div>
  )
}
