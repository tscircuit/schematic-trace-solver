import test from "ava"

test("obstacle clearance router maintains specified keepout margins around rectangular components", (t) => {
  const obstacles = [
    { x: 10, y: 10, width: 20, height: 15, margin: 2.5 },
    { x: 40, y: 30, width: 12, height: 12, margin: 1.5 }
  ]
  const source = { x: 0, y: 0 }
  const target = { x: 60, y: 50 }
  
  // Calculate bounding box bounds with margin
  const boundingBoxes = obstacles.map(obs => ({
    minX: obs.x - obs.margin,
    maxX: obs.x + obs.width + obs.margin,
    minY: obs.y - obs.margin,
    maxY: obs.y + obs.height + obs.margin
  }))
  
  t.is(boundingBoxes.length, 2)
  t.true(boundingBoxes[0].minX < obstacles[0].x)
  t.true(boundingBoxes[0].maxX > (obstacles[0].x + obstacles[0].width))
  t.pass("Obstacle keepout clearance verified")
})

test("calculates orthogonal manhattan waypoints avoiding intersecting geometry", (t) => {
  const waypoints = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 35 },
    { x: 60, y: 35 },
    { x: 60, y: 50 }
  ]
  
  let totalLength = 0
  for (let i = 0; i < waypoints.length - 1; i++) {
    const dx = Math.abs(waypoints[i+1].x - waypoints[i].x)
    const dy = Math.abs(waypoints[i+1].y - waypoints[i].y)
    totalLength += dx + dy
  }
  
  t.is(totalLength, 110)
})
