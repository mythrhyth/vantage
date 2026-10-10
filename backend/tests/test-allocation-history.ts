import {
  computeAggregateWeights,
  generateHistorySeries,
  getResponsiveTickIndices,
  Asset,
} from '../../src/components/allocation/AllocationHistory'

function runAllocationHistoryTests() {
  console.log('====================================================')
  console.log('RUNNING ALLOCATION HISTORY COMPONENT UNIT TESTS')
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

  // 1. Test Aggregate Weight Calculation with Assets
  console.log('--- 1. Testing Aggregate Weight Calculations ---')
  const mockAssets: Asset[] = [
    { company: 'Tech Corp', sector: 'Technology', current: 15.5 },
    { company: 'Fin Bank', sector: 'Financial Services', current: 10.2 },
    { company: 'Software Inc', sector: 'Information Technology', current: 12.0 },
    { company: 'Retail Co', sector: 'Consumer Cyclical', current: 5.0 },
  ]

  const weights = computeAggregateWeights(mockAssets)
  assert(
    weights.techWeight === 27.5,
    `Technology weight sums correctly (expected 27.5, got ${weights.techWeight})`
  )
  assert(
    weights.finWeight === 10.2,
    `Financials weight sums correctly (expected 10.2, got ${weights.finWeight})`
  )

  // Test proposed weights taking precedence
  const proposedWeights = [20.0, 8.0, 10.0, 5.0]
  const proposedResult = computeAggregateWeights(mockAssets, proposedWeights)
  assert(
    proposedResult.techWeight === 30.0,
    `Proposed Technology weight overrides current (expected 30.0, got ${proposedResult.techWeight})`
  )
  assert(
    proposedResult.finWeight === 8.0,
    `Proposed Financials weight overrides current (expected 8.0, got ${proposedResult.finWeight})`
  )

  // 2. Test Empty Assets Fallback
  console.log('\n--- 2. Testing Empty Asset Fallback ---')
  const emptyWeights = computeAggregateWeights([])
  assert(
    emptyWeights.techWeight === 19.82,
    `Empty assets fall back to default baseline Tech weight (19.82%)`
  )
  assert(
    emptyWeights.finWeight === 6.21,
    `Empty assets fall back to default baseline Fin weight (6.21%)`
  )

  // 3. Test 12-Month Series Generation & Chronological Ordering
  console.log('\n--- 3. Testing 12-Month Series Generation & Changes ---')
  const series = generateHistorySeries(27.5, 10.2, 50)
  assert(
    series.length === 12,
    `History series generates exactly 12 monthly data points (got ${series.length})`
  )
  assert(
    series[0].month === 'Jul 25' && series[11].month === 'Jun 26',
    `Months ordered chronologically from 'Jul 25' to 'Jun 26'`
  )
  assert(
    series[11].tech === 27.5,
    `Latest Technology series point matches current weight (27.5%)`
  )
  assert(
    series[11].fin === 10.2,
    `Latest Financials series point matches current weight (10.2%)`
  )
  assert(
    series[11].isLatest === true,
    `Latest data point marked as isLatest = true`
  )

  const tech12mChange = parseFloat((series[11].tech - series[0].tech).toFixed(2))
  const fin12mChange = parseFloat((series[11].fin - series[0].fin).toFixed(2))
  assert(
    !isNaN(tech12mChange) && !isNaN(fin12mChange),
    `12-month change is valid numeric percentage change (${tech12mChange}% tech, ${fin12mChange}% fin)`
  )

  // 4. Test Responsive Tick Density Logic
  console.log('\n--- 4. Testing Responsive Tick Density Indices ---')
  const mobileTicks = getResponsiveTickIndices(400, 12)
  assert(
    mobileTicks.length === 5 && mobileTicks.includes(11),
    `Mobile view (< 480px) reduces ticks to 5 labels including latest month`
  )

  const tabletTicks = getResponsiveTickIndices(600, 12)
  assert(
    tabletTicks.length === 7 && tabletTicks.includes(11),
    `Tablet view (480-680px) reduces ticks to 7 alternating labels including latest month`
  )

  const desktopTicks = getResponsiveTickIndices(800, 12)
  assert(
    desktopTicks.length === 12,
    `Desktop view (>= 680px) displays all 12 month labels`
  )

  console.log('\n====================================================')
  if (failed === 0) {
    console.log(`ALL ALLOCATION HISTORY TESTS PASSED! (${passed}/${passed}) 🎉`)
  } else {
    console.error(`TESTS FAILED: ${failed} failed out of ${passed + failed}`)
    process.exit(1)
  }
}

runAllocationHistoryTests()
