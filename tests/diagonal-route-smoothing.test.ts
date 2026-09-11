import test from "ava"

test("applies diagonal penalty weight to prioritize orthogonal manhattan segments", (t) => {
  const orthogonalCost = 1.0
  const diagonalPenaltyMultiplier = 1.414
  
  const calculateSegmentCost = (dx: number, dy: number) => {
    if (dx !== 0 && dy !== 0) {
      return Math.sqrt(dx * dx + dy * dy) * diagonalPenaltyMultiplier
    }
    return (Math.abs(dx) + Math.abs(dy)) * orthogonalCost
  }
  
  t.is(calculateSegmentCost(10, 0), 10.0)
  t.is(calculateSegmentCost(0, 15), 15.0)
  t.true(calculateSegmentCost(10, 10) > 14.14)
})

test("smoothes 90-degree corner vertices into chamfered waypoints", (t) => {
  const corner = { x: 10, y: 10 }
  const chamferRadius = 1.0
  
  const chamferPoints = [
    { x: corner.x - chamferRadius, y: corner.y },
    { x: corner.x, y: corner.y + chamferRadius }
  ]
  
  t.is(chamferPoints.length, 2)
  t.is(chamferPoints[0].x, 9.0)
  t.is(chamferPoints[1].y, 11.0)
})
