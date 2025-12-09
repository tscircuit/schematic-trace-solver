import { expect, test } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import "tests/fixtures/matcher"
const inputProblem: InputProblem = {
  chips: [
    // JP6 - The chip on the left
    {
      chipId: "JP6",
      center: { x: -4, y: 0 },
      width: 2,
      height: 1.5,
      pins: [
        {
          pinId: "JP6.2", // Top pin (VOUT)
          x: -3,
          y: 0.2,
          _facingDirection: "x+",
        },
        {
          pinId: "JP6.1", // Bottom pin (GND)
          x: -3,
          y: -0.2,
          _facingDirection: "x+",
        },
      ],
    },
    // R1 - The resistor on the right
    {
      chipId: "R1",
      center: { x: 3, y: 0.575 },
      width: 0.6,
      height: 1.2,
      pins: [
        {
          pinId: "R1.1", // Top pin
          x: 3,
          y: 1.175,
          _facingDirection: "y+",
        },
        {
          pinId: "R1.2", // Bottom pin
          x: 3,
          y: -0.025,
          _facingDirection: "y-",
        },
      ],
    },
  ],
  // Two directConnections on the same net (implicitly) plus a self-connection
  directConnections: [
    {
      // Top trace: JP6 Top -> R1 Top
      pinIds: ["JP6.2", "R1.1"],
    },
    {
      // Bottom trace: JP6 Bottom -> R1 Bottom
      pinIds: ["JP6.1", "R1.2"],
    },
    {
      // Resistor self-connection (Short)
      pinIds: ["R1.1", "R1.2"],
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  // Allow long traces to connect these components
  maxMspPairDistance: 100,
}

test("SameNetTraceMergeSolver01: merge same-net parallel traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
  const beforeTraces = solver.traceCleanupSolver?.getOutput().traces ?? []
  const afterTraces = solver.sameNetTraceMergeSolver?.getOutput().traces ?? []

  // Verify solver completed
  expect(solver.solved).toBe(true)
  expect(solver.sameNetTraceMergeSolver?.solved).toBe(true)

  // Both should have the same number of traces (we don't collapse traces, just align segments)
  expect(afterTraces.length).toBeGreaterThan(0)
  expect(afterTraces.length).toBe(beforeTraces.length)

  // Check that some horizontal or vertical segments moved (merged to same coordinate)
  let movedSegments = 0
  const EPS = 1e-6

  const beforeMap = new Map<string, any>(
    beforeTraces.map((t: any) => [t.mspPairId, t]),
  )
  const afterMap = new Map<string, any>(
    afterTraces.map((t: any) => [t.mspPairId, t]),
  )

  for (const [id, beforeTrace] of beforeMap.entries()) {
    const afterTrace = afterMap.get(id)
    if (!afterTrace) continue

    const beforePath = beforeTrace.tracePath
    const afterPath = afterTrace.tracePath
    const len = Math.min(beforePath.length, afterPath.length)

    for (let i = 0; i < len; i++) {
      const p1 = beforePath[i]
      const p2 = afterPath[i]
      if (Math.abs(p1.x - p2.x) > EPS || Math.abs(p1.y - p2.y) > EPS) {
        movedSegments++
      }
    }
  }

  // We expect at least some segments to have moved (merged to common coordinates)
  expect(movedSegments).toBeGreaterThan(0)
})
