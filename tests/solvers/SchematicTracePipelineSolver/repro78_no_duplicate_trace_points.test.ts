import { test, expect } from "bun:test"
import { UntangleTraceSubsolver } from "lib/solvers/TraceCleanupSolver/sub-solver/UntangleTraceSubsolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Regression test for issue #78.
 *
 * When _applyBestRoute() splices [...prefix, ...bestRoute, ...suffix], the
 * boundary points can be exact duplicates (prefix[-1] == bestRoute[0] or
 * bestRoute[-1] == suffix[0]), producing zero-length segments that render
 * as spurious extra trace lines.
 *
 * We verify that no consecutive duplicate points exist in any output trace
 * after the solver runs.
 */

function hasDuplicateConsecutivePoints(
  points: Array<{ x: number; y: number }>,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6) {
      return true
    }
  }
  return false
}

test("repro78: UntangleTraceSubsolver produces no consecutive duplicate points in output traces", () => {
  // Two traces that cross in an L-shape pattern, forcing UntangleTraceSubsolver
  // to reroute one of them.  The crossing is deliberately crafted so that
  // the rerouted segment shares a boundary point with the original prefix/suffix,
  // which is exactly the scenario that caused duplicate points before the fix.
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "net1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      mspConnectionPairIds: [],
      pinIds: [],
      pins: [] as any,
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 }, // L-turn corner (p2 in lShape)
        { x: 4, y: 2 },
      ],
    },
    {
      mspPairId: "net2",
      dcConnNetId: "net2",
      globalConnNetId: "net2",
      mspConnectionPairIds: [],
      pinIds: [],
      pins: [] as any,
      tracePath: [
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 3 },
      ],
    },
  ]

  const solver = new UntangleTraceSubsolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
      maxMspPairDistance: 5,
    } as any,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.2,
  })

  solver.solve()

  const output = solver.getOutput()

  for (const trace of output.traces) {
    const hasDups = hasDuplicateConsecutivePoints(trace.tracePath)
    expect(hasDups).toBe(false)
  }
})

test("repro78: SchematicTracePipelineSolver pipeline produces no duplicate trace points", () => {
  // Use the full pipeline solver with a simple two-chip problem that is likely
  // to trigger UntangleTraceSubsolver rerouting, then verify no duplicates.
  const { SchematicTracePipelineSolver } = require("lib/index")

  const inputProblem = {
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
        chipId: "C1",
        center: { x: -2, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C1.1", x: -2, y: 0.5 },
          { pinId: "C1.2", x: -2, y: -0.5 },
        ],
      },
      {
        chipId: "C2",
        center: { x: -4, y: 0 },
        width: 0.5,
        height: 1,
        pins: [
          { pinId: "C2.1", x: -4, y: 0.5 },
          { pinId: "C2.2", x: -4, y: -0.5 },
        ],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "VCC" },
      { pinIds: ["U1.2", "C2.1"], netId: "EN" },
    ],
    netConnections: [
      { pinIds: ["U1.3", "C2.2", "C1.2"], netId: "GND" },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      EN: ["x+", "x-"],
      GND: ["y-"],
    },
    maxMspPairDistance: 2,
  }

  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  expect(solver.solved).toBe(true)

  // Gather all trace paths from the pipeline output
  const allTraces: Array<{ x: number; y: number }[]> = []
  if (solver.traceCleanupSolver?.outputTraces) {
    for (const trace of solver.traceCleanupSolver.outputTraces) {
      allTraces.push(trace.tracePath)
    }
  } else if (solver.schematicTraceLinesSolver?.solvedTracePaths) {
    for (const trace of solver.schematicTraceLinesSolver.solvedTracePaths) {
      allTraces.push(trace.tracePath)
    }
  }

  for (const tracePath of allTraces) {
    expect(hasDuplicateConsecutivePoints(tracePath)).toBe(false)
  }
})
