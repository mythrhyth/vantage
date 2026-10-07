import React, { useState, useEffect, useMemo } from "react"
import {
  Page,
  IconName,
  ScenarioName,
  ScenarioControls,
  StressTestRun,
  StressTestHistoryEntry,
  AssetName,
} from "./types"
import {
  titleCase,
  mappedScenarioForEvent,
  signedValue,
  generateEventStressParameters,
  calculateScenarioLoss,
} from "./utils"
import { Icon } from "./components/common/Icon"
import { VantageLogo } from "./components/common/VantageLogo"
import { Button } from "./components/common/Button"
import { Slider } from "./components/common/Slider"
import { Summary } from "./components/common/Summary"
import { PanelTitle } from "./components/common/PanelTitle"
import { PageHeading } from "./components/common/PageHeading"
import { SettingsPanel } from "./components/common/SettingsPanel"
import { RiskHistogram } from "./components/risk-intelligence/RiskHistogram"
import { EventTable } from "./components/risk-intelligence/EventTable"
import { EventExplainabilityDialog } from "./components/risk-intelligence/EventExplainabilityDialog"
import { MiniDistribution } from "./components/risk-intelligence/MiniDistribution"
import { AllocationChart } from "./components/allocation/AllocationChart"
import { AllocationHistory } from "./components/allocation/AllocationHistory"
import { AllocationExplanationDialog } from "./components/allocation/AllocationExplanationDialog"
import { OverallAllocationDialog } from "./components/allocation/OverallAllocationDialog"
import { AssetLossDialog } from "./components/stress-testing/AssetLossDialog"
import { WhyLossDialog } from "./components/stress-testing/WhyLossDialog"
import { EventStressComparisonDialog } from "./components/stress-testing/EventStressComparisonDialog"
import { ScenarioComparisonDialog } from "./components/scenario-analysis/ScenarioComparisonDialog"
import { Landing } from "./pages/Landing"
import { Overview } from "./pages/Overview"
import { RiskIntelligence } from "./pages/RiskIntelligence"
import { IndexAllocation } from "./pages/IndexAllocation"
import { PortfolioStressTesting } from "./pages/PortfolioStressTesting"
import { Scenarios } from "./pages/Scenarios"
import { ProfilePage } from "./pages/ProfilePage"
import { WorkspaceSettingsPage } from "./pages/WorkspaceSettingsPage"
import { PortfolioSetupPage } from "./pages/PortfolioSetupPage"
import { LoggedOut } from "./pages/LoggedOut"
import "./index.css"

export default function App() {
  const [page, setPage] = useState<Page>("Home")
  const [dark, setDark] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [portfolioId, setPortfolioId] = useState<string | null>(null)
  const [stressRun, setStressRun] = useState<StressTestRun | null>(null)
  const [stressHistory, setStressHistory] = useState<StressTestHistoryEntry[]>(
    [],
  )

  useEffect(() => {
    import("./services/api").then(({ riskApi }) => {
      riskApi.getPortfolios().then(data => {
        if (data.length > 0) setPortfolioId(data[0].id)
      }).catch(err => console.error("Failed to fetch portfolios", err))
    })
  }, [])

  const navigateManually = (target: Page) => {
    if (target === "Scenarios" || target === "Scenario Analysis") setStressRun(null)
    setPage(target)
  }
  if (signedOut) {
    return (
      <div className="app" data-theme={dark ? "dark" : "light"}>
        <LoggedOut
          onSignIn={() => {
            setSignedOut(false)
            setPage("Home")
          }}
        />
      </div>
    )
  }
  return (
    <div className="app" data-theme={dark ? "dark" : "light"}>
      <aside className="sidebar">
        <button
          className="brand-home"
          onClick={() => setPage("Home")}
          title="VANTAGE home"
        >
          <VantageLogo />
        </button>
        <nav>
          {[
            { page: "Overview", icon: "overview" as IconName, mobileLabel: "Overview" },
            { page: "Risk Intelligence", icon: "intelligence" as IconName, mobileLabel: "Intelligence" },
            { page: "Index Allocation", icon: "allocation" as IconName, mobileLabel: "Allocation" },
            { page: "Portfolio Stress Testing", icon: "stress" as IconName, mobileLabel: "Stress" },
            { page: "Scenario Analysis", icon: "scenario" as IconName, mobileLabel: "Scenarios" }
          ].map((item) => (
            <button
              key={item.page}
              className={page === item.page || (item.page === "Scenario Analysis" && page === "Scenarios") ? "active" : ""}
              onClick={() => navigateManually(item.page as Page)}
              title={item.page}
            >
              <Icon name={item.icon} />
              <span>{item.page}</span>
              <small>{item.mobileLabel}</small>
            </button>
          ))}
        </nav>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <VantageLogo compact />
            <i />
            <span>{page}</span>
          </div>
          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={() => setDark(!dark)}
              title={`Switch to ${dark ? "light" : "dark"} theme`}
            >
              <Icon name={dark ? "sun" : "moon"} size={17} />
            </button>
            <button
              className="settings-button"
              onClick={() => setPage("Workspace Settings")}
              title="Settings"
            >
              <Icon name="settings" size={17} />
            </button>
            <div className="profile-wrap">
              <button
                className="profile-button"
                onClick={() => setProfileOpen(!profileOpen)}
              >
                <span className="profile-avatar">AR</span>
                <span>
                  <b>Analyst</b>
                  <small>Risk team</small>
                </span>
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <span className="profile-avatar large">AR</span>
                    <span>
                      <b>Arjun Rao</b>
                      <small>Senior Risk Analyst</small>
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPage("Profile")
                      setProfileOpen(false)
                    }}
                  >
                    <Icon name="user" size={15} />
                    Profile details
                  </button>
                  <button
                    onClick={() => {
                      setPage("Workspace Settings")
                      setProfileOpen(false)
                    }}
                  >
                    <Icon name="settings" size={15} />
                    Workspace settings
                  </button>
                  <button
                    className="profile-logout"
                    onClick={() => {
                      setSignedOut(true)
                      setProfileOpen(false)
                    }}
                  >
                    <Icon name="user" size={15} />
                    Log out
                  </button>
                  <div className="profile-meta">
                    <span>Last sign-in</span>
                    <b>Today, 09:12 IST</b>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          {page === "Home" && <Landing navigate={navigateManually} />}
          {page === "Overview" && <Overview portfolioId={portfolioId} />}
          {page === "Portfolio Setup" && <PortfolioSetupPage portfolioId={portfolioId} />}
          {page === "Risk Intelligence" && (
            <RiskIntelligence
              portfolioId={portfolioId}
              runStressTest={async (event) => {
                try {
                  const { riskApi } = await import("./services/api")
                  const scenarios = await riskApi.getScenarios()
                  const mappedName = mappedScenarioForEvent(event.category)
                  const sc = scenarios.find((s: any) => s.name === mappedName) || scenarios[0]
                  if (!sc) return
                  const params = await riskApi.generateParameters(event.id, sc.id)
                  setStressRun({
                    event,
                    scenario: sc.name,
                    scenarioId: sc.id,
                    parameters: params,
                    runId: Date.now()
                  } as any)
                  setPage("Scenario Analysis")
                } catch (e) {
                  console.error(e)
                }
              }}
            />
          )}
          {page === "Index Allocation" && <IndexAllocation portfolioId={portfolioId} />}
          {page === "Portfolio Stress Testing" && (
            <PortfolioStressTesting
              portfolioId={portfolioId}
              triggerEvent={stressRun?.event ?? null}
              openScenario={() => setPage("Scenario Analysis")}
            />
          )}
          {(page === "Scenarios" || page === "Scenario Analysis") && (
            <Scenarios
              key={
                stressRun
                  ? `event-run-${stressRun.runId}-v2`
                  : "manual-scenario-v2"
              }
              portfolioId={portfolioId}
              stressRun={stressRun}
              history={stressHistory}
              onRunCompleted={(entry) => {
                setStressHistory((current) =>
                  current.some((item) => item.runId === entry.runId)
                    ? current
                    : [entry, ...current],
                )
              }}
              onOpenHistory={(entry) => {
                setStressRun({
                  event: entry.event,
                  scenario: entry.scenario,
                  parameters: entry.parameters,
                  runId: Date.now(),
                  skipProcessing: true,
                })
              }}
            />
          )}
          {page === "Profile" && (
            <ProfilePage
              openSettings={() => setPage("Workspace Settings")}
              onLogout={() => setSignedOut(true)}
            />
          )}
          {page === "Workspace Settings" && (
            <WorkspaceSettingsPage dark={dark} setDark={setDark} portfolioId={portfolioId} />
          )}
        </main>
      </div>
    </div>
  )
}
