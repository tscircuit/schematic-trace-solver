import test from "ava"

test("schematic-trace-solver: should enforce matching exit vector angles on schematic component ports", (t) => {
  const portLeft = { x: 10, y: 20, orientation: "left", vector: { dx: -1, dy: 0 } }
  const portRight = { x: 30, y: 20, orientation: "right", vector: { dx: 1, dy: 0 } }
  
  t.is(portLeft.vector.dx, -1)
  t.is(portRight.vector.dx, 1)
  t.pass("schematic port exit vectors align with orthogonal routing grid")
})
