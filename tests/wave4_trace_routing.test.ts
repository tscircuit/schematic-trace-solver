import test from 'ava'

test('Wave 4: Manhattan distance trace route cost heuristic evaluation', (t) => {
  const calculateManhattanCost = (p1: {x: number, y: number}, p2: {x: number, y: number}, bendPenalty: number, bends: number) => {
    const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
    return dist + (bendPenalty * bends)
  }

  const costStraight = calculateManhattanCost({x: 0, y: 0}, {x: 10, y: 10}, 5, 1)
  t.is(costStraight, 25)

  const costMultipleBends = calculateManhattanCost({x: 0, y: 0}, {x: 10, y: 10}, 5, 3)
  t.is(costMultipleBends, 35)
})

test('Wave 4: Obstacle bounding box intersection and trace clearance check', (t) => {
  const isPointInObstacle = (p: {x: number, y: number}, obs: {minX: number, minY: number, maxX: number, maxY: number}) => {
    return p.x >= obs.minX && p.x <= obs.maxX && p.y >= obs.minY && p.y <= obs.maxY
  }

  const obstacle = {minX: 10, minY: 10, maxX: 20, maxY: 20}
  t.true(isPointInObstacle({x: 15, y: 15}, obstacle))
  t.false(isPointInObstacle({x: 5, y: 15}, obstacle))
  t.false(isPointInObstacle({x: 25, y: 15}, obstacle))
})
