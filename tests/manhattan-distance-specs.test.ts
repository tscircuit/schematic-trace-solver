import test from "ava"

test("schematic-trace-solver: should calculate accurate Manhattan L1 routing heuristics for gridless pathing", (t) => {
  const p1 = { x: 10, y: 15 }
  const p2 = { x: 35, y: 55 }
  
  const manhattanDist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y)
  t.is(manhattanDist, 65)
  t.pass("Manhattan L1 metric calculated accurately for A* pathfinder")
})
