export type Page = "Home" | "Overview" | "Risk Intelligence" | "Index Allocation" | "Portfolio Stress Testing" | "Scenarios" | "Scenario Analysis" | "Profile" | "Workspace Settings" | "Portfolio Setup"

export type IconName = "overview" | "intelligence" | "allocation" | "stress" | "scenario" | "sun" | "moon" | "arrow" | "reset" | "close" | "user" | "settings" | "info" | "portfolio"

export type ScenarioName = keyof typeof scenarioData

export type ScenarioControls = typeof scenarioData[ScenarioName]

export type StressTestRun = {
  event: typeof events[number]
  scenario: ScenarioName
  parameters: ScenarioControls
  runId: number
  skipProcessing?: boolean
}

export type StressTestHistoryEntry = StressTestRun & {
  loss: number
  completedAt: string
}

export type AssetName = "Loans" | "Bonds" | "Derivatives" | "Liquidity"
