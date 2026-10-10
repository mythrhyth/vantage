import { riskEngineService } from '../../backend/src/services/risk-engine/risk-engine.service'
import { portfolioService } from '../../backend/src/services/portfolios/portfolio.service'
import { prisma } from '../../backend/src/server'

async function runPortfolioStressTestingTests() {
  console.log('====================================================')
  console.log('RUNNING PORTFOLIO STRESS TESTING WORKFLOW REGRESSION TESTS')
  console.log('====================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`)
      passed++
    } else {
      console.error(`❌ FAIL: ${message}`)
      failed++
    }
  }

  try {
    // 1. Portfolio loading and constituent asset exposure mapping
    console.log('--- 1. Testing Portfolio & Constituent Asset Reconciliation ---')
    const portfolios = await portfolioService.listPortfolios()
    assert(portfolios.length > 0, 'Active portfolio found in DB')

    const portfolio = portfolios[0]
    console.log(`   - Selected Portfolio: "${portfolio.name}" (ID: ${portfolio.id})`)
    console.log(`   - Baseline Value: ₹${portfolio.baselineValue} Cr`)

    const loans = portfolio.loansExposure || 0
    const bonds = portfolio.bondsExposure || 0
    const derivatives = portfolio.derivativesExposure || 0
    const equity = portfolio.equityExposure || 0
    const totalExposure = loans + bonds + derivatives + equity

    console.log(`   - Holdings: Loans ₹${loans} Cr, Bonds ₹${bonds} Cr, Derivatives ₹${derivatives} Cr, Equity ₹${equity} Cr`)
    console.log(`   - Total Asset Sum: ₹${totalExposure} Cr`)

    assert(
      totalExposure > 0,
      `Constituent asset exposures are non-zero (Total: ₹${totalExposure} Cr)`
    )
    assert(
      Math.abs(totalExposure - portfolio.baselineValue) < 1.0,
      `Constituent exposure total strictly reconciles to portfolio baseline (₹${portfolio.baselineValue} Cr)`
    )

    // 2. Stress Test Execution with Market & Macro Shocks
    console.log('\n--- 2. Testing End-to-End Stress Test Execution ---')
    const shockedParams = {
      sp: 70, // -30% S&P 500 shock
      emerging: 80, // -20% Emerging shock
      technology: 65, // -35% Tech shock
      rates: 150, // +50% Rate hike
      inflation: 120, // +20% Inflation shock
    }

    const runResult = await riskEngineService.runStressTest(portfolio.id, shockedParams)

    assert(
      runResult !== null && typeof runResult.id === 'string',
      `Stress test executed successfully and generated run ID: ${runResult.id}`
    )
    assert(
      runResult.baseline_value === portfolio.baselineValue,
      `Run result baseline matches portfolio baseline (₹${runResult.baseline_value} Cr)`
    )
    assert(
      runResult.absolute_loss > 0,
      `Calculated non-zero loss under market shocks (Loss: ₹${runResult.absolute_loss.toFixed(2)} Cr)`
    )
    assert(
      runResult.stressed_value === parseFloat((runResult.baseline_value - runResult.absolute_loss).toFixed(2)) ||
      Math.abs(runResult.stressed_value - (runResult.baseline_value - runResult.absolute_loss)) < 0.1,
      `Stressed portfolio value reconciles (Baseline ₹${runResult.baseline_value} - Loss ₹${runResult.absolute_loss.toFixed(1)} = Stressed ₹${runResult.stressed_value.toFixed(1)})`
    )
    assert(
      runResult.attribution_result && typeof runResult.attribution_result.loansLoss === 'number',
      `Attribution result contains individual asset-class loss breakdown (Loans: ₹${runResult.attribution_result?.loansLoss} Cr, Bonds: ₹${runResult.attribution_result?.bondsLoss} Cr, Equity: ₹${runResult.attribution_result?.equityLoss} Cr)`
    )

    // 3. Testing Zero-Loss vs Unrun State Invariant
    console.log('\n--- 3. Testing Zero-Loss vs Baseline Unshocked Invariant ---')
    const baselineParams = {
      sp: 100,
      emerging: 100,
      technology: 100,
      oil: 100,
      gold: 100,
      dollar: 100,
      rates: 100,
      inflation: 100,
    }

    const zeroLossRun = await riskEngineService.runStressTest(portfolio.id, baselineParams)
    assert(
      zeroLossRun.absolute_loss === 0,
      `Unshocked parameters (all 100) return explicit 0 loss (absolute_loss = 0)`
    )
    assert(
      zeroLossRun.stressed_value === zeroLossRun.baseline_value,
      `Unshocked stressed value equals baseline value (₹${zeroLossRun.stressed_value} Cr)`
    )

    // 4. Invalid Portfolio Error Handling
    console.log('\n--- 4. Testing Invalid Portfolio Error Handling ---')
    let caughtError = false
    try {
      await riskEngineService.runStressTest('non-existent-uuid-12345', shockedParams)
    } catch (err: any) {
      caughtError = true
      assert(
        err.message.includes('not found') || err.message.includes('Portfolio'),
        `Invalid portfolio ID throws descriptive error ("${err.message}") without generating fake result`
      )
    }
    assert(caughtError, `Failed request correctly threw error`)

    // 6. Automatic Event-to-Stress-Test Integration & Parameter Precedence Tests
    console.log('\n--- 6. Testing Event-to-Stress-Test Auto Integration & Parameter Precedence ---')
    
    // Fetch real events from database for testing
    const events = await prisma.riskEvent.findMany({ take: 5 })
    assert(events.length >= 2, 'Found at least 2 risk events in database for testing')

    const rateEvent = events.find(e => e.category?.toLowerCase().includes('monetary') || e.category?.toLowerCase().includes('rate')) || events[0]
    const creditEvent = events.find(e => e.id !== rateEvent.id) || events[1]

    // 6a. Valid event with no explicit shocks -> event_derived parameters
    console.log(`   - Testing Event 1 Auto-Derivation: "${rateEvent.title}" (${rateEvent.category})`)
    const eventRun1 = await riskEngineService.runStressTest(portfolio.id, {}, undefined, rateEvent.id)
    assert(
      eventRun1.parameters_used?.parameter_source === 'event_derived',
      `Run correctly marked parameter_source as "event_derived"`
    )
    assert(
      typeof eventRun1.parameters_used?.rate === 'number' && typeof eventRun1.parameters_used?.spread === 'number',
      `Event-derived parameters contain rate (${eventRun1.parameters_used?.rate} bps) and spread (${eventRun1.parameters_used?.spread} bps)`
    )
    assert(
      eventRun1.event_id === rateEvent.id,
      `Run record preserved event_id: ${eventRun1.event_id}`
    )

    // 6b. Two materially different events produce different resolved parameters
    console.log(`   - Testing Event 2 Auto-Derivation: "${creditEvent.title}" (${creditEvent.category})`)
    const eventRun2 = await riskEngineService.runStressTest(portfolio.id, {}, undefined, creditEvent.id)
    assert(
      eventRun2.parameters_used?.parameter_source === 'event_derived',
      `Event 2 run correctly marked parameter_source as "event_derived"`
    )
    const distinctParams = (
      eventRun1.parameters_used?.rate !== eventRun2.parameters_used?.rate ||
      eventRun1.parameters_used?.spread !== eventRun2.parameters_used?.spread ||
      eventRun1.parameters_used?.liquidity !== eventRun2.parameters_used?.liquidity
    )
    assert(
      distinctParams,
      `Two materially different events produced distinct derived parameters (Event 1 rate=${eventRun1.parameters_used?.rate}/spread=${eventRun1.parameters_used?.spread} vs Event 2 rate=${eventRun2.parameters_used?.rate}/spread=${eventRun2.parameters_used?.spread})`
    )

    // 6c. Irrelevant event follows existing relevance behavior (0 loss)
    console.log(`   - Testing Irrelevant Event Behavior`)
    const irrelevantEvent = await prisma.riskEvent.create({
      data: {
        title: 'MOCK: Irrelevant Local Event',
        entity: 'Test Entity',
        source: 'Test Source',
        category: 'Sector outlook',
        sentiment: -0.8,
        impact: 8.0,
        horizon: 'SHORT_TERM',
        relevance_type: 'IRRELEVANT',
        relevance_reason: 'No portfolio asset exposure',
        relevance_score: 0.0,
        signals: [],
        sentiment_drivers: [],
        impact_factors: [],
        affected_areas: [],
        risk_flow: []
      }
    })

    const irrelevantRun = await riskEngineService.runStressTest(portfolio.id, {}, undefined, irrelevantEvent.id)
    assert(
      irrelevantRun.parameters_used?.parameter_source === 'event_derived',
      `Irrelevant event run marked parameter_source as "event_derived"`
    )
    assert(
      irrelevantRun.absolute_loss === 0,
      `Irrelevant event produces 0 absolute loss under documented relevance behavior (loss = ₹${irrelevantRun.absolute_loss} Cr)`
    )

    // Clean up temporary mock irrelevant event
    await prisma.riskEvent.delete({ where: { id: irrelevantEvent.id } })

    // 6d. Explicit manual shocks retain precedence over event ID
    console.log(`   - Testing Explicit Manual Shock Precedence Over Event`)
    const manualPrecedenceRun = await riskEngineService.runStressTest(
      portfolio.id,
      { sp: 70, rates: 150 },
      undefined,
      rateEvent.id
    )
    assert(
      manualPrecedenceRun.parameters_used?.parameter_source === 'manual',
      `Manual shock parameters took precedence over event ID (parameter_source = "manual")`
    )
    assert(
      manualPrecedenceRun.parameters_used?.sp === 70 && manualPrecedenceRun.parameters_used?.rates === 150,
      `Manual shock values (sp: 70, rates: 150) preserved in resolved parameters`
    )

    // 6e. Invalid or missing event ID throws clear error
    console.log(`   - Testing Invalid Event ID Error Handling`)
    let invalidEventErrorCaught = false
    try {
      await riskEngineService.runStressTest(portfolio.id, {}, undefined, '00000000-0000-0000-0000-000000000000')
    } catch (err: any) {
      invalidEventErrorCaught = true
      assert(
        err.message.includes('Risk event not found'),
        `Invalid event ID threw clear error ("${err.message}") without silent fallback to default shocks`
      )
    }
    assert(invalidEventErrorCaught, `Invalid event ID correctly rejected with error`)

    // 7. Scenario Presets, Loss Attribution & Allocation Application Tests
    console.log('\n--- 7. Testing Scenario Presets, Attribution & Allocation Application ---')

    // 7a. Preset scenarios evaluation produces finite non-NaN values
    console.log(`   - Testing Preset Scenario Finite Evaluation`)
    const presetConfigs = [
      { name: 'Interest Rate Shock', params: { rate: 250, spread: 120, liquidity: 8, inflation: 150 } },
      { name: 'Credit Crisis', params: { rate: -50, spread: 350, liquidity: 20, inflation: 50 } },
      { name: 'Combined Macro Stress', params: { rate: 150, spread: 250, liquidity: 15, inflation: 200 } }
    ]

    for (const preset of presetConfigs) {
      const pRun = await riskEngineService.runStressTest(portfolio.id, preset.params)
      assert(
        Number.isFinite(pRun.baseline_value) && Number.isFinite(pRun.stressed_value) && Number.isFinite(pRun.absolute_loss),
        `Preset "${preset.name}" returned finite non-NaN results (Baseline: ₹${pRun.baseline_value}, Loss: ₹${pRun.absolute_loss} Cr)`
      )
    }

    // 7b. Factor attribution & exact linear decomposition reconciliation
    console.log(`   - Testing Factor Attribution Exact Reconciliation`)
    const attr = runResult.attribution_result as any
    const factorLossSum = attr.factors.reduce((sum: number, f: any) => sum + (Number(f.loss) || 0), 0)
    assert(
      Number.isFinite(attr.interaction_residual) && attr.interaction_residual >= 0,
      `Attribution result includes valid non-negative interaction residual (₹${attr.interaction_residual} Cr)`
    )
    assert(
      Number.isFinite(factorLossSum),
      `Factor contribution sum is finite (₹${factorLossSum.toFixed(2)} Cr)`
    )
    assert(
      Math.abs((factorLossSum + attr.interaction_residual) - runResult.absolute_loss) < 0.1,
      `Factor losses + interaction residual (₹${(factorLossSum + attr.interaction_residual).toFixed(2)} Cr) strictly reconcile to total loss (₹${runResult.absolute_loss.toFixed(2)} Cr)`
    )

    // 7c. Default Probability Parameter Causal Credit Loss Test
    console.log(`   - Testing Default Probability Credit Loss Parameterization`)
    const runZeroPD = await riskEngineService.runStressTest(portfolio.id, { rate: 100, spread: 50, probability: 0 })
    const runHighPD = await riskEngineService.runStressTest(portfolio.id, { rate: 100, spread: 50, probability: 10 })
    const pdFactorVal = (runHighPD.attribution_result as any)?.factors?.find((f: any) => f.factor === 'default_probability')?.loss ?? 0

    assert(
      runHighPD.attribution_result.loansLoss > runZeroPD.attribution_result.loansLoss,
      `Default probability slider (10% PD) increased loan losses (Zero PD: ₹${runZeroPD.attribution_result.loansLoss} Cr vs 10% PD: ₹${runHighPD.attribution_result.loansLoss} Cr)`
    )
    assert(
      pdFactorVal > 0,
      `Default probability factor contribution is parameterized and positive (₹${pdFactorVal.toFixed(2)} Cr)`
    )

    // 7c. Allocation Application & Persistence to Database
    console.log(`   - Testing Allocation Application & Holdings Persistence`)
    const originalAssets = await portfolioService.getPortfolioAssets(portfolio.id)
    const equityAssets = originalAssets.filter(a => (a.assetType || '').toUpperCase() === 'EQUITY' || Boolean(a.ticker))

    if (equityAssets.length > 0) {
      const modifiedHoldings = equityAssets.map((a, i) => ({
        ticker: a.ticker || `STOCK_${i}`,
        company: a.company || 'Test Corp',
        sector: a.sector || 'General',
        currentWeight: i === 0 ? 10.0 : 2.0
      }))

      await portfolioService.updateHoldings(portfolio.id, modifiedHoldings)
      const updatedPortfolio = await portfolioService.getPortfolioById(portfolio.id)
      const newEquityExp = updatedPortfolio?.equityExposure || 0

      assert(
        newEquityExp > 0,
        `Applied allocation successfully persisted new equity holdings (New Equity Exposure: ₹${newEquityExp} Cr)`
      )

      // Restore original holdings
      const restoreHoldings = equityAssets.map(a => ({
        ticker: a.ticker || 'STOCK',
        company: a.company || 'Corp',
        sector: a.sector || 'General',
        currentWeight: Number(a.currentWeight) || 2.0
      }))
      await portfolioService.updateHoldings(portfolio.id, restoreHoldings)
      console.log(`   - Restored original portfolio equity holdings successfully`)
    }

    console.log('\n====================================================')
    if (failed === 0) {
      console.log(`ALL PORTFOLIO STRESS TESTING TESTS PASSED! (${passed}/${passed}) 🎉`)
    } else {
      console.error(`TESTS FAILED: ${failed} failed out of ${passed + failed}`)
      process.exit(1)
    }
  } catch (err) {
    console.error('Test execution error:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runPortfolioStressTestingTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
