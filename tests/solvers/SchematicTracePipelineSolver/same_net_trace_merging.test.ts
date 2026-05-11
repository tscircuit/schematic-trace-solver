import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

// Test case for Issue #34: Merge same-net trace lines that are close together (same Y)
const sameYProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.2 },
        { pinId: "U1.2", x: -0.8, y: 0 },
        { pinId: "U1.3", x: -0.8, y: -0.2 },
        { pinId: "U1.4", x: 0.8, y: -0.2 },
        { pinId: "U1.5", x: 0.8, y: 0 },
        { pinId: "U1.6", x: 0.8, y: 0.2 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 4, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U2.1", x: 3.2, y: 0.2 },
        { pinId: "U2.2", x: 3.2, y: 0 },
        { pinId: "U2.3", x: 3.2, y: -0.2 },
        { pinId: "U2.4", x: 4.8, y: -0.2 },
        { pinId: "U2.5", x: 4.8, y: 0 },
        { pinId: "U2.6", x: 4.8, y: 0.2 },
      ],
    },
  ],
  traces: [
    // Trace from U1.1 to middle point at y=2
    { net: "NET1", path: [{ x: -0.8, y: 0.2 }, { x: -0.8, y: 2 }, { x: 2, y: 2 }] },
    // Trace from middle point at y=2 to U2.1 - same Y as above
    { net: "NET1", path: [{ x: 2, y: 2 }, { x: 3.2, y: 0.2 }] },
  ],
  tracePaths: [],
}

test("merges same-net trace segments at same Y coordinate", async () => {
  const solver = new SchematicTracePipelineSolver()
  const result = await solver.solve(sameYProblem)
  
  // After merging, there should be fewer trace segments for NET1
  // The two segments at y=2 should be merged into one
  const net1Traces = result.traces.filter(t => t.net === "NET1")
  
  // Should merge into a single continuous path
  expect(net1Traces.length).toBeLessThanOrEqual(1)
})

// Test case for same X coordinate merging
const sameXProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [{ pinId: "U1.1", x: -0.8, y: 0 }],
    },
    {
      chipId: "U2", 
      center: { x: 0, y: 4 },
      width: 1.6,
      height: 0.6,
      pins: [{ pinId: "U2.1", x: -0.8, y: 4 }],
    },
  ],
  traces: [
    { net: "NET1", path: [{ x: -0.8, y: 0 }, { x: -0.8, y: 2 }] },
    { net: "NET1", path: [{ x: -0.8, y: 2 }, { x: -0.8, y: 4 }] },
  ],
  tracePaths: [],
}

test("merges same-net trace segments at same X coordinate", async () => {
  const solver = new SchematicTracePipelineSolver()
  const result = await solver.solve(sameXProblem)
  
  const net1Traces = result.traces.filter(t => t.net === "NET1")
  
  // Should merge into a single vertical trace
  expect(net1Traces.length).toBeLessThanOrEqual(1)
})
