import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (mspPairId: string, y: number): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: "dc0",
    globalConnNetId: "net0",
    userNetId: "VCC",
    pins: [
      { chipId: "A", pinId: `${mspPairId}.1`, x: 0, y },
      { chipId: "B", pinId: `${mspPairId}.2`, x: 2, y },
    ],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
    mspConnectionPairIds: [mspPairId],
    tracePath: [
      { x: 0, y },
      { x: 2, y },
    ],
  }) satisfies SolvedTracePath

test("same-net trace consolidation runs after cleanup and before final label placement", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  const phaseNames = solver.pipelineDef.map((p) => p.solverName)
  const cleanupIndex = phaseNames.indexOf("traceCleanupSolver")
  const consolidationIndex = phaseNames.indexOf(
    "sameNetTraceConsolidationSolver",
  )
  const finalLabelPlacementIndex = phaseNames.lastIndexOf(
    "netLabelPlacementSolver",
  )

  expect(cleanupIndex).toBeGreaterThan(-1)
  expect(consolidationIndex).toBeGreaterThan(cleanupIndex)
  expect(finalLabelPlacementIndex).toBeGreaterThan(consolidationIndex)
})

test("final label placement and downstream solvers prefer consolidated traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem) as any
  const cleanupTrace = makeTrace("cleanup", 0.08)
  const consolidatedTrace = makeTrace("consolidated", 0)

  solver.traceLabelOverlapAvoidanceSolver = {
    getOutput: () => ({ traces: [makeTrace("avoided", 0.16)] }),
  }
  solver.traceCleanupSolver = {
    getOutput: () => ({ traces: [cleanupTrace] }),
  }
  solver.sameNetTraceConsolidationSolver = {
    getOutput: () => ({
      traces: [consolidatedTrace],
      correctedTraceMap: { [consolidatedTrace.mspPairId]: consolidatedTrace },
    }),
  }
  solver.netLabelPlacementSolver = { netLabelPlacements: [] }

  const finalLabelStep = solver.pipelineDef.findLast(
    (p: any) => p.solverName === "netLabelPlacementSolver",
  )!
  const [finalLabelParams] = finalLabelStep.getConstructorParams(solver)

  expect(Object.keys(finalLabelParams.inputTraceMap)).toEqual(["consolidated"])
  expect(finalLabelParams.inputTraceMap.consolidated).toBe(consolidatedTrace)

  const example28Step = solver.pipelineDef.find(
    (p: any) => p.solverName === "example28Solver",
  )!
  const [example28Params] = example28Step.getConstructorParams(solver)

  expect(example28Params.traces).toEqual([consolidatedTrace])
})
