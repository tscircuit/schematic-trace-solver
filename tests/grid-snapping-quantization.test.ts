import test from "ava"

test("quantizes arbitrary floating point coordinates to nearest 0.1 inch schematic grid unit", (t) => {
  const gridSize = 2.54 // 0.1 inch in mm
  
  const snapToGrid = (val: number) => Math.round(val / gridSize) * gridSize
  
  t.is(snapToGrid(2.4), 2.54)
  t.is(snapToGrid(5.0), 5.08)
  t.is(snapToGrid(0.2), 0)
})

test("preserves orthogonal alignment when snapping connected multi-point wire waypoints", (t) => {
  const rawWaypoints = [
    { x: 2.5, y: 5.1 },
    { x: 10.2, y: 5.1 },
    { x: 10.2, y: 15.3 }
  ]
  const gridSize = 2.54
  const snapped = rawWaypoints.map(p => ({
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize
  }))
  
  t.is(snapped[0].y, snapped[1].y)
  t.is(snapped[1].x, snapped[2].x)
})
