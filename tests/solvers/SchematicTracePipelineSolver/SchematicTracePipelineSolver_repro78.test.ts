import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("SchematicTracePipelineSolver_repro78 - Fix ladder lines in DISCH fixture", () => {
  // This fixture triggered "ladder lines" in the past
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 10,
        height: 10,
        pins: [
          { pinId: "P1", x: -5, y: -2 },
          { pinId: "P2", x: -5, y: 2 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 30, y: 0 },
        width: 10,
        height: 10,
        pins: [
            { pinId: "P3", x: 25, y: -2 },
            { pinId: "P4", x: 25, y: 2 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["P1", "P3"], netId: "net1" },
      { pinIds: ["P2", "P4"], netId: "net1" },
    ],
    netConnections: [
        { netId: "net1", pinIds: ["P1", "P3", "P2", "P4"] }
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 6, // Trigger larger search distance
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  // Get the traces from the final net label placement solver (which uses the merged traces)
  // Or just from the last step.
  const traces = solver.traceCleanupSolver!.getOutput().traces
  
  // Verify that there are no redundant parallel lines
  // A "ladder" would manifest as multiple segments between same X/Y coords
  // For net1, we should have a clean set of paths connecting all 4 pins.
  
  // Check for any overlapping segments
  const segments: any[] = []
  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
        segments.push({ p1: trace.tracePath[i], p2: trace.tracePath[i+1] })
    }
  }

  // Basic check: No two segments should be parallel and overlapping
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
        const s1 = segments[i]
        const s2 = segments[j]
        
        // If they are both horizontal and share same Y
        if (Math.abs(s1.p1.y - s1.p2.y) < 0.001 && Math.abs(s2.p1.y - s2.p2.y) < 0.001 && Math.abs(s1.p1.y - s2.p1.y) < 0.001) {
            const min1 = Math.min(s1.p1.x, s1.p2.x)
            const max1 = Math.max(s1.p1.x, s1.p2.x)
            const min2 = Math.min(s2.p1.x, s2.p2.x)
            const max2 = Math.max(s2.p1.x, s2.p2.x)
            
            const overlap = Math.max(0, Math.min(max1, max2) - Math.max(min1, min2))
            expect(overlap).toBeLessThan(0.001) // Should not overlap
        }
    }
  }
})
