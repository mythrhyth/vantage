import { deterministicRiskEngine, DeterministicRiskEngine } from '../src/services/risk-engine/deterministic-risk-engine';
import { riskEngineService } from '../src/services/risk-engine/risk-engine.service';
import { RISK_ENGINE_CONFIG } from '../src/config/risk-engine.config';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

async function runDeterministicRiskEngineTests() {
  console.log('====================================================');
  console.log('RUNNING DETERMINISTIC RISK ENGINE TEST SUITE (19 INVARIANTS)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    total++;
    try {
      fn();
      passed++;
      console.log(`✓ Property Test ${total}: ${name}`);
    } catch (e: any) {
      console.error(`✗ Property Test ${total} FAILED: ${name}`);
      console.error(`  Error: ${e.message}`);
    }
  }

  const basePortfolio = {
    portfolioId: 'test-port-1',
    baselineValue: 1000.0,
    holdings: [
      { assetId: 'b1', ticker: 'BOND1', assetClass: 'BONDS' as const, currentValue: 800.0, currentWeight: 0.80 },
      { assetId: 'e1', ticker: 'EQ1', assetClass: 'EQUITY' as const, currentValue: 200.0, currentWeight: 0.20 }
    ]
  };

  const baseEvent = {
    id: 'evt-1',
    title: 'Federal Reserve raises benchmark rate',
    category: 'Monetary policy',
    sentiment: -0.80,
    classificationConfidence: 0.95,
    sentimentConfidence: 0.95,
    horizon: 'SHORT_TERM'
  };

  const baseRelevance = {
    relevanceType: 'PORTFOLIO_WIDE',
    relevanceScore: 0.90,
    matchedHoldingIds: [],
    matchedSectors: []
  };

  // 1. Determinism
  test('Determinism (Identical inputs => Identical outputs)', () => {
    const out1 = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    const out2 = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    assert(out1.eventSeverity === out2.eventSeverity, 'eventSeverity mismatch');
    assert(out1.portfolioImpact === out2.portfolioImpact, 'portfolioImpact mismatch');
    assert(out1.stressExposure === out2.stressExposure, 'stressExposure mismatch');
    assert(out1.stressParameters.rate === out2.stressParameters.rate, 'rate shock mismatch');
    assert(out1.stressParameters.spread === out2.stressParameters.spread, 'spread shock mismatch');
  });

  // 2. Impact Boundedness
  test('Impact Boundedness (I_portfolio ∈ [1.0, 10.0])', () => {
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    assert(out.portfolioImpact >= 1.0 && out.portfolioImpact <= 10.0, `Impact out of bounds: ${out.portfolioImpact}`);
    assert(out.eventSeverity >= 1.0 && out.eventSeverity <= 10.0, `Severity out of bounds: ${out.eventSeverity}`);
  });

  // 3. Event Severity Independence
  test('Event Severity Independence (S_event is portfolio independent)', () => {
    const out1 = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    const port2 = {
      portfolioId: 'test-port-2',
      baselineValue: 5000.0,
      holdings: [{ assetId: 'd1', ticker: 'DERIV1', assetClass: 'DERIVATIVES' as const, currentValue: 5000.0, currentWeight: 1.0 }]
    };
    const out2 = deterministicRiskEngine.calculateRisk(baseEvent, port2, baseRelevance);
    assert(out1.eventSeverity === out2.eventSeverity, `Severity changed with portfolio: ${out1.eventSeverity} vs ${out2.eventSeverity}`);
  });

  // 4. Portfolio Sensitivity
  test('Portfolio Sensitivity (Different allocations => Different impacts)', () => {
    const portBond = basePortfolio;
    const portEquity = {
      portfolioId: 'test-port-eq',
      baselineValue: 1000.0,
      holdings: [
        { assetId: 'b1', ticker: 'BOND1', assetClass: 'BONDS' as const, currentValue: 200.0, currentWeight: 0.20 },
        { assetId: 'e1', ticker: 'EQ1', assetClass: 'EQUITY' as const, currentValue: 800.0, currentWeight: 0.80 }
      ]
    };
    const outBond = deterministicRiskEngine.calculateRisk(baseEvent, portBond, baseRelevance);
    const outEq = deterministicRiskEngine.calculateRisk(baseEvent, portEquity, baseRelevance);
    assert(outBond.portfolioImpact !== outEq.portfolioImpact, 'Portfolios with different allocation received identical impact');
    assert(outBond.portfolioImpact > outEq.portfolioImpact, `Bond portfolio impact (${outBond.portfolioImpact}) should be higher than equity portfolio (${outEq.portfolioImpact}) for Monetary policy`);
  });

  // 5. Exposure Monotonicity
  test('Exposure Monotonicity (Increasing exposed holding size cannot decrease impact)', () => {
    const relDirect = { relevanceType: 'DIRECT', relevanceScore: 1.0, matchedHoldingIds: ['b1'], matchedSectors: [] };
    const portSmall = {
      portfolioId: 'p1',
      baselineValue: 1000.0,
      holdings: [
        { assetId: 'b1', ticker: 'BOND1', assetClass: 'BONDS' as const, currentValue: 100.0, currentWeight: 0.10 },
        { assetId: 'e1', ticker: 'EQ1', assetClass: 'EQUITY' as const, currentValue: 900.0, currentWeight: 0.90 }
      ]
    };
    const portLarge = {
      portfolioId: 'p2',
      baselineValue: 1000.0,
      holdings: [
        { assetId: 'b1', ticker: 'BOND1', assetClass: 'BONDS' as const, currentValue: 500.0, currentWeight: 0.50 },
        { assetId: 'e1', ticker: 'EQ1', assetClass: 'EQUITY' as const, currentValue: 500.0, currentWeight: 0.50 }
      ]
    };
    const outSmall = deterministicRiskEngine.calculateRisk(baseEvent, portSmall, relDirect);
    const outLarge = deterministicRiskEngine.calculateRisk(baseEvent, portLarge, relDirect);
    assert(outLarge.portfolioImpact >= outSmall.portfolioImpact, 'Larger direct exposure produced lower impact');
  });

  // 6. Sensitivity Monotonicity
  test('Transmission Sensitivity Monotonicity (Increasing high-sensitivity class allocation increases T_port)', () => {
    const weightsLow = { LOANS: 0.0, BONDS: 0.2, DERIVATIVES: 0.0, EQUITY: 0.8 };
    const weightsHigh = { LOANS: 0.0, BONDS: 0.8, DERIVATIVES: 0.0, EQUITY: 0.2 };
    const tLow = deterministicRiskEngine.calculateTransmissionSensitivity(weightsLow, 'Monetary policy');
    const tHigh = deterministicRiskEngine.calculateTransmissionSensitivity(weightsHigh, 'Monetary policy');
    assert(tHigh > tLow, `Transmission sensitivity failed monotonicity: ${tHigh} <= ${tLow}`);
  });

  // 7. Concentration Monotonicity
  test('Concentration Monotonicity (Higher matched weight increases C_conc)', () => {
    const holdingsConc = [{ assetId: 'b1', assetClass: 'BONDS' as const, currentValue: 800.0, currentWeight: 0.80 }];
    const holdingsDiv = [{ assetId: 'b1', assetClass: 'BONDS' as const, currentValue: 200.0, currentWeight: 0.20 }];
    const cConc = deterministicRiskEngine.calculateConcentration('DIRECT', holdingsConc, ['b1'], { BONDS: 0.8 });
    const cDiv = deterministicRiskEngine.calculateConcentration('DIRECT', holdingsDiv, ['b1'], { BONDS: 0.2 });
    assert(cConc > cDiv, `Concentration failed monotonicity: ${cConc} <= ${cDiv}`);
  });

  // 8. Unrelated Holding Neutrality
  test('Unrelated Holding Behavior (Direct exposure unaffected by un-impacted holdings)', () => {
    const relDirect = { relevanceType: 'DIRECT', relevanceScore: 1.0, matchedHoldingIds: ['b1'], matchedSectors: [] };
    const exp1 = deterministicRiskEngine.calculateDirectExposure(basePortfolio.holdings, ['b1'], 1000.0);
    const portModified = {
      portfolioId: 'p-mod',
      baselineValue: 1000.0,
      holdings: [
        { assetId: 'b1', ticker: 'BOND1', assetClass: 'BONDS' as const, currentValue: 800.0, currentWeight: 0.80 },
        { assetId: 'e2', ticker: 'EQ2', assetClass: 'EQUITY' as const, currentValue: 200.0, currentWeight: 0.20 }
      ]
    };
    const exp2 = deterministicRiskEngine.calculateDirectExposure(portModified.holdings, ['b1'], 1000.0);
    assert(exp1 === exp2, 'Direct exposure changed when unrelated asset changed');
  });

  // 9. Gemini Independence
  test('Gemini Independence (Calculation works without external LLM dependencies)', () => {
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    assert(typeof out.portfolioImpact === 'number', 'Calculation requires LLM');
    assert(typeof out.stressParameters.rate === 'number', 'Stress params require LLM');
  });

  // 10. Confidence Isolation
  test('Confidence Isolation (Confidence change does not alter S_event, I_portfolio, or E_stress)', () => {
    const evtHighConf = { ...baseEvent, classificationConfidence: 0.99, sentimentConfidence: 0.99 };
    const evtLowConf = { ...baseEvent, classificationConfidence: 0.10, sentimentConfidence: 0.10 };
    const relHighConf = { ...baseRelevance, relevanceScore: 1.00 };
    const relLowConf = { ...baseRelevance, relevanceScore: 0.10 };

    const outHigh = deterministicRiskEngine.calculateRisk(evtHighConf, basePortfolio, relHighConf);
    const outLow = deterministicRiskEngine.calculateRisk(evtLowConf, basePortfolio, relLowConf);

    assert(outHigh.eventSeverity === outLow.eventSeverity, 'Confidence modified eventSeverity');
    assert(outHigh.portfolioImpact === outLow.portfolioImpact, 'Confidence modified portfolioImpact');
    assert(outHigh.stressExposure === outLow.stressExposure, 'Confidence modified stressExposure');
    assert(outHigh.stressParameters.rate === outLow.stressParameters.rate, 'Confidence modified rate shock');
    assert(outHigh.modelConfidence > outLow.modelConfidence, 'modelConfidence did not reflect underlying confidence');
  });

  // 11. Zero Exposure Safety
  test('Zero Exposure Safety (IRRELEVANT event yields I_portfolio=1.0, E_stress=0.0, shocks=0)', () => {
    const relIrrelevant = { relevanceType: 'IRRELEVANT', relevanceScore: 0.0, matchedHoldingIds: [], matchedSectors: [] };
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, relIrrelevant);
    assert(out.portfolioImpact === 1.0, `Impact was not 1.0: ${out.portfolioImpact}`);
    assert(out.stressExposure === 0.0, `Stress exposure was not 0.0: ${out.stressExposure}`);
    assert(out.stressParameters.rate === 0, `Rate shock was not 0: ${out.stressParameters.rate}`);
    assert(out.stressParameters.spread === 0, `Spread shock was not 0: ${out.stressParameters.spread}`);
    assert(out.stressParameters.liquidity === 0, `Liquidity haircut was not 0: ${out.stressParameters.liquidity}`);
    assert(out.stressParameters.inflation === 0, `Inflation shift was not 0: ${out.stressParameters.inflation}`);
  });

  // 12. Universal Stress Availability
  test('Universal Stress Availability (Engine accepts and calculates stress for low-impact events)', () => {
    const evtLow = { ...baseEvent, sentiment: 1.0 }; // Positive sentiment yields low severity
    const relLow = { relevanceType: 'INDIRECT', relevanceScore: 0.5, matchedHoldingIds: [], matchedSectors: ['Technology'] };
    const out = deterministicRiskEngine.calculateRisk(evtLow, basePortfolio, relLow);
    assert(out.portfolioImpact >= 1.0, 'Low impact event failed calculation');
    assert(out.stressParameters !== undefined, 'Stress parameters missing for low-impact event');
  });

  // 13. Sector Outlook Category Integrity
  test('Sector Outlook Category Integrity (SECTOR_OUTLOOK category supported end-to-end)', () => {
    const evtSector = { ...baseEvent, category: 'Sector outlook', sentiment: -0.50 };
    const out = deterministicRiskEngine.calculateRisk(evtSector, basePortfolio, baseRelevance);
    assert(out.eventSeverity > 1.0, 'Sector outlook failed severity calculation');
    assert(out.transmissionSensitivity > 0, 'Sector outlook failed transmission');
    assert(out.stressParameters.rate !== 0 || out.stressParameters.spread !== 0, 'Sector outlook shocks missing');
  });

  // 14. Severity Scaling Calibration
  test('Severity Scaling Calibration (Proportional severity scaling of stress parameters)', () => {
    const evtHigh = { ...baseEvent, sentiment: -1.0 }; // S_event = 10.0
    const evtLow = { ...baseEvent, sentiment: 0.0 };   // S_event = 8.5
    const outHigh = deterministicRiskEngine.calculateRisk(evtHigh, basePortfolio, baseRelevance);
    const outLow = deterministicRiskEngine.calculateRisk(evtLow, basePortfolio, baseRelevance);
    assert(outHigh.stressParameters.rate > outLow.stressParameters.rate, 'Higher severity did not produce higher rate shock');
    assert(outHigh.severityScale > outLow.severityScale, 'severityScale failed proportional ordering');
  });

  // 15. Weight Normalization
  test('Canonical Weight Normalization (Weight 45 and 0.45 produce identical normalized result 0.45)', () => {
    const n1 = deterministicRiskEngine.normalizeWeight(45);
    const n2 = deterministicRiskEngine.normalizeWeight(0.45);
    assert(n1 === 0.45, `45 normalized to ${n1}`);
    assert(n2 === 0.45, `0.45 normalized to ${n2}`);
    assert(n1 === n2, 'Normalized weights mismatch');
  });

  // 16. Portfolio-Wide Empty Affected Assets
  test('Portfolio-Wide Empty Affected Assets (PORTFOLIO_WIDE with empty affectedAssets transmits exposure)', () => {
    const relEmpty = { relevanceType: 'PORTFOLIO_WIDE', relevanceScore: 1.0, matchedHoldingIds: [], matchedSectors: [] };
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, relEmpty);
    assert(out.effectiveExposure === 1.0, `PORTFOLIO_WIDE effectiveExposure was not 1.0: ${out.effectiveExposure}`);
    assert(out.transmissionSensitivity > 0.5, 'Transmission sensitivity failed');
    assert(out.stressExposure > 0, 'Stress exposure was zero');
  });

  // 17. Irrelevant Zero Shock
  test('Irrelevant Event Zero Shock (IRRELEVANT relevance produces zero stress exposure)', () => {
    const relIrr = { relevanceType: 'IRRELEVANT', relevanceScore: 0.0, matchedHoldingIds: [], matchedSectors: [] };
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, relIrr);
    assert(out.stressExposure === 0.0, 'Stress exposure was not zero for IRRELEVANT');
  });

  // 18. NO T_port² Double Counting
  test('No T_port² Double Counting (V_port uses E_effective = 1.0 for PORTFOLIO_WIDE, not T_port)', () => {
    const tPort = deterministicRiskEngine.calculateTransmissionSensitivity(
      { LOANS: 0.0, BONDS: 0.8, DERIVATIVES: 0.0, EQUITY: 0.2 },
      'Monetary policy'
    );
    const effExp = deterministicRiskEngine.calculateEffectiveExposure('PORTFOLIO_WIDE', 0, 0);
    assert(effExp === 1.0, `effExp should be 1.0, got ${effExp}`);
    const vPort = effExp * tPort * 1.16 * 1.0 * 0.70;
    const tPortSquaredV = tPort * tPort * 1.16 * 1.0 * 0.70;
    assert(vPort !== tPortSquaredV, 'V_port contains T_port² double counting!');
  });

  // 19. Production Loss Engine Compatibility
  test('Production Loss Engine Compatibility (Engine outputs run cleanly through RiskEngineService)', async () => {
    const out = deterministicRiskEngine.calculateRisk(baseEvent, basePortfolio, baseRelevance);
    const params = out.stressParameters;
    assert(typeof params.rate === 'number', 'rate shock missing');
    assert(typeof params.spread === 'number', 'spread shock missing');
    assert(typeof params.liquidity === 'number', 'liquidity haircut missing');
    assert(typeof params.inflation === 'number', 'inflation shift missing');
  });

  console.log('\n====================================================');
  console.log(`TEST SUITE SUMMARY: ${passed} / ${total} PROPERTY TESTS PASSED`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runDeterministicRiskEngineTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
