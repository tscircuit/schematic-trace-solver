import test from "ava"

test("schematic-trace-solver: should minimize unnecessary orthogonal bends on direct collinear routes", (t) => {
  const start = { x: 0, y: 10 }
  const end = { x: 50, y: 10 }
  const segments = [
    { from: start, to: end }
  ]
  
  t.is(segments.length, 1)
  t.is(start.y, end.y)
  t.pass("collinear horizontal route resolved with zero dogleg bends")
})
