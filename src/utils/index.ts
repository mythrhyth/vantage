export function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function mappedScenarioForEvent(category: string) {
  const mappings: Record<string, string> = {
    "Monetary policy": "Interest Rate Shock",
    Credit: "Credit Crisis",
    Commodities: "Oil Shock",
    Earnings: "Equity Market Crash",
    "Sector outlook": "Equity Market Crash",
    Geopolitical: "Combined Macro Stress",
    Macroeconomic: "Combined Macro Stress",
    "M&A": "Equity Market Crash",
    "Product launch": "Equity Market Crash",
  }
  return mappings[category] ?? "Custom Scenario"
}

export function signedValue(value: number, digits = 1) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`
}

export function generateEventStressParameters(
  event: typeof events[number],
  scenario: ScenarioName,
): ScenarioControls {
  if (event.category === "Monetary policy") {
    return {
      rate: 250,
      spread: 120,
      probability: 2,
      liquidity: 8,
      inflation: 150,
    }
  }
  if (event.category === "Credit") {
    return {
      rate: -50,
      spread: Math.round(event.impact * 50),
      probability: Number((event.impact * 0.8).toFixed(1)),
      liquidity: Math.round(event.impact * 2),
      inflation: Math.round(event.sentiment * -50),
    }
  }
  if (event.category === "Commodities") {
    return {
      rate: Math.round(event.impact * 14),
      spread: Math.round(event.impact * 20),
      probability: Number((event.impact * 0.45).toFixed(1)),
      liquidity: Math.round(event.impact * 1.5),
      inflation: Math.round(event.impact * 41),
    }
  }
  if (event.category === "Earnings" || event.category === "Sector outlook") {
    const severity = event.impact / 10
    return {
      rate: Math.round(-75 * severity),
      spread: Math.round(250 * severity),
      probability: Number((5 * severity).toFixed(1)),
      liquidity: Math.round(20 * severity),
      inflation: Math.round(-50 * severity),
    }
  }
  const base = {
    rate: 100,
    spread: 100,
    probability: 2,
    liquidity: 10,
    inflation: 100,
  }
  const severity = Math.max(0.55, event.impact / 8)
  return {
    rate: Math.round(base.rate * severity),
    spread: Math.round(base.spread * severity),
    probability: Number((base.probability * severity).toFixed(1)),
    liquidity: Math.round(base.liquidity * severity),
    inflation: Math.round(base.inflation * severity),
  }
}

export function calculateScenarioLoss(input: ScenarioControls) {
  return Math.max(
    12,
    input.rate * 0.07 +
      input.spread * 0.09 +
      input.probability * 5.8 +
      input.liquidity * 1.5 +
      input.inflation * 0.025,
  )
}
