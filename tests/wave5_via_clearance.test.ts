import test from 'ava'

test('Wave 5: Multi-layer PCB via drill hole clearance radius safety bounds', (t) => {
  const calculateViaClearance = (drillRadius: number, annularRingWidth: number, minIsolationGap: number) => {
    return drillRadius + annularRingWidth + minIsolationGap
  }

  const clearance = calculateViaClearance(0.15, 0.1, 0.15)
  t.is(Math.round(clearance * 100) / 100, 0.4)
})

test('Wave 5: Via-to-trace distance collision detector', (t) => {
  const isViaClearOfTrace = (viaPos: {x: number, y: number}, traceSegment: {x: number, y: number}, minSafeDistance: number) => {
    const dist = Math.hypot(viaPos.x - traceSegment.x, viaPos.y - traceSegment.y)
    return dist >= minSafeDistance
  }

  t.true(isViaClearOfTrace({x: 0, y: 0}, {x: 1.0, y: 1.0}, 0.5))
  t.false(isViaClearOfTrace({x: 0, y: 0}, {x: 0.2, y: 0.2}, 0.5))
})
