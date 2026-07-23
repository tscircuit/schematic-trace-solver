import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro47-endpoint-obstacle-detour.input.json"

test("repro47: endpoint obstacle detours route around nearby components", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(
    solver
      .schematicTraceLinesSolver!.failedConnectionPairs.map(
        (pair) => pair.mspPairId,
      )
      .sort(),
  ).toEqual([])

  const j1Pin1Trace = solver.schematicTraceLinesSolver!.solvedTracePaths.find(
    (trace) => trace.mspPairId === "J1.1-R1.1",
  )
  const bottomChipEdge = Math.min(
    ...inputProblem.chips.map((chip) => chip.center.y - chip.height / 2),
  )
  expect(j1Pin1Trace).toBeDefined()
  expect(
    Math.min(...j1Pin1Trace!.tracePath.map((point) => point.y)),
  ).toBeLessThan(bottomChipEdge)

  const finalTraces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const traceById = new Map(
    finalTraces.map((trace) => [trace.mspPairId, trace]),
  )
  expect(
    countPathIntersections(
      traceById.get("J1.1-R1.1")!.tracePath,
      traceById.get("R2.2-R3.1")!.tracePath,
    ),
  ).toBe(0)
  expect(
    countPathIntersections(
      traceById.get("J1.3-R1.2")!.tracePath,
      traceById.get("R2.1-R3.2")!.tracePath,
    ),
  ).toBe(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
