import test from 'ava'

test('Wave 7: Multi-layer PCB trace transition via penalty cost heuristic', (t) => {
  const calculateTransitionCost = (layer1: string, layer2: string, baseLengthCost: number, viaPenalty: number) => {
    return layer1 === layer2 ? baseLengthCost : baseLengthCost + viaPenalty
  }

  const planarCost = calculateTransitionCost('top', 'top', 12.5, 5.0)
  t.is(planarCost, 12.5)

  const multiLayerCost = calculateTransitionCost('top', 'bottom', 12.5, 5.0)
  t.is(multiLayerCost, 17.5)
})

test('Wave 7: Trace segment intersection collision detection', (t) => {
  const doHorizontalAndVerticalOverlap = (
    hY: number, hX1: number, hX2: number,
    vX: number, vY1: number, vY2: number
  ) => {
    const minHX = Math.min(hX1, hX2)
    const maxHX = Math.max(hX1, hX2)
    const minVY = Math.min(vY1, vY2)
    const maxVY = Math.max(vY1, vY2)
    return vX >= minHX && vX <= maxHX && hY >= minVY && hY <= maxVY
  }

  t.true(doHorizontalAndVerticalOverlap(10, 0, 20, 10, 0, 20))
  t.false(doHorizontalAndVerticalOverlap(10, 0, 20, 25, 0, 20))
})
