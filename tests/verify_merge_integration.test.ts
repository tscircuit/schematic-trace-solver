import { test, expect } from "bun:test"
import { SameNetSegmentMergeSolver } from "lib/solvers/SameNetSegmentMergeSolver/SameNetSegmentMergeSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

test("SameNetSegmentMergeSolver is reachable through pipeline", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  // Find the pipeline step for sameNetSegmentMergeSolver
  const stepNames = solver["pipelineDef"].map((p: any) => p.solverName)
  expect(stepNames).toContain("sameNetSegmentMergeSolver")

  // Verify it comes after traceCleanupSolver and before netLabelPlacementSolver
  const mergeIdx = stepNames.indexOf("sameNetSegmentMergeSolver")
  const cleanupIdx = stepNames.indexOf("traceCleanupSolver")
  const netLabelIdx = stepNames.indexOf("netLabelPlacementSolver")

  expect(mergeIdx).toBeGreaterThan(cleanupIdx)
  // The netLabelPlacementSolver appears multiple times, so check that
  // mergeIdx is less than at least one occurrence
  expect(mergeIdx).toBeLessThan(netLabelIdx)
})

test("SameNetSegmentMergeSolver basic merge", () => {
  // Create input with two traces on the same net that have close parallel segments
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1" as any,
      dcConnNetId: "net.GND",
      globalConnNetId: "net.GND",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"] as any,
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "U1" },
        { pinId: "pin2", x: 4, y: 0, chipId: "U2" },
      ] as any,
    },
    {
      mspPairId: "pair2" as any,
      dcConnNetId: "net.GND",
      globalConnNetId: "net.GND",
      tracePath: [
        { x: 1, y: 0.05 },
        { x: 3, y: 0.05 },
      ],
      mspConnectionPairIds: ["pair2"] as any,
      pinIds: ["pin3", "pin4"],
      pins: [
        { pinId: "pin3", x: 1, y: 0.05, chipId: "U3" },
        { pinId: "pin4", x: 3, y: 0.05, chipId: "U4" },
      ] as any,
    },
  ]

  const input: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const solver = new SameNetSegmentMergeSolver({
    inputProblem: input,
    allTraces: traces,
    mergeThreshold: 0.1,
  })

  solver.solve()

  // Should have merged into one trace
  expect(solver.outputTraces.length).toBeLessThan(traces.length)
  expect(solver.solved).toBe(true)
})