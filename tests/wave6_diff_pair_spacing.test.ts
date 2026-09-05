import test from 'ava'

test('Wave 6: Differential pair trace parallel spacing and skew length matching heuristic', (t) => {
  const calculatePairSkew = (lengthPositive: number, lengthNegative: number) => {
    return Math.abs(lengthPositive - lengthNegative)
  }

  const isPairSkewAcceptable = (skewMm: number, maxAllowedSkewMm: number) => {
    return skewMm <= maxAllowedSkewMm
  }

  const skew = calculatePairSkew(45.2, 45.35)
  t.is(Math.round(skew * 100) / 100, 0.15)
  t.true(isPairSkewAcceptable(skew, 0.2))
  t.false(isPairSkewAcceptable(skew, 0.1))
})

test('Wave 6: Minimum edge-to-edge parallel trace clearance verification', (t) => {
  const isParallelClearanceSufficient = (centerDistance: number, traceWidth: number, minSpacing: number) => {
    const edgeDistance = centerDistance - traceWidth
    return edgeDistance >= minSpacing
  }

  t.true(isParallelClearanceSufficient(0.5, 0.2, 0.25))
  t.false(isParallelClearanceSufficient(0.4, 0.2, 0.25))
})
