import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

/**
 * Regression test for issue #78: "Fix extra trace lines in post-processing step"
 *
 * When UntangleTraceSubsolver reroutes an L-shaped turn it splices a bestRoute
 * segment into the original trace path:
 *
 *   newTracePath = [...slice(0, p2Index), ...bestRoute, ...slice(p2Index + 1)]
 *
 * The last point of the left slice equals the first point of bestRoute (p1),
 * and the last point of bestRoute (p3) equals the first point of the right
 * slice.  Those duplicate points produce zero-length segments that render as
 * spurious extra trace lines in the schematic viewer.
 *
 * The fix calls removeDuplicateConsecutivePoints() on the assembled path so
 * that the duplicate boundary points are eliminated before the trace is stored.
 */
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.0,
      height: 2.0,
      pins: [
        { pinId: "U1.1", x: -0.5, y: 0.5 },
        { pinId: "U1.2", x: -0.5, y: -0.5 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 4, y: 0 },
      width: 1.0,
      height: 2.0,
      pins: [
        { pinId: "U2.1", x: 3.5, y: 0.5 },
        { pinId: "U2.2", x: 3.5, y: -0.5 },
      ],
    },
    {
      chipId: "U3",
      center: { x: 2, y: 3 },
      width: 1.0,
      height: 2.0,
      pins: [
        { pinId: "U3.1", x: 1.5, y: 3.5 },
        { pinId: "U3.2", x: 1.5, y: 2.5 },
      ],
    },
  ],
  directConnections: [
    { netId: "NET_A", pinIds: ["U1.1", "U2.1"] },
    { netId: "NET_B", pinIds: ["U1.2", "U3.2"] },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

test("SchematicTracePipelineSolver_repro78: no duplicate consecutive points in solved traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  const EPS = 1e-9

  // Collect all trace paths from every sub-solver that may produce them
  const traceCleanupSolver = solver.traceCleanupSolver
  if (!traceCleanupSolver) return

  for (const trace of traceCleanupSolver.getOutput().traces) {
    const path = trace.tracePath
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1]
      const curr = path[i]
      const dx = Math.abs(curr.x - prev.x)
      const dy = Math.abs(curr.y - prev.y)
      const isDuplicate = dx <= EPS && dy <= EPS
      expect(isDuplicate).toBe(false)
    }
  }
})

test("SchematicTracePipelineSolver_repro78: solver completes without error", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  expect(() => solver.solve()).not.toThrow()
  expect(solver.solved).toBe(true)
})
