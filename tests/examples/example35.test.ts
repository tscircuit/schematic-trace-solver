import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { MergeParallelTracesSolver } from "lib/solvers/MergeParallelTracesSolver/MergeParallelTracesSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example35.json"
import preMergeTraces from "../assets/example35-pre-merge-traces.json"
import "tests/fixtures/matcher"

const cloneInputTracePaths = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
    mspConnectionPairIds: [...trace.mspConnectionPairIds],
    pinIds: [...trace.pinIds],
  }))

/**
 * Issue #34: same-net trace segments that are almost on the same Y (or X) get
 * snapped onto a shared axis — removes the small jog between parallel runs.
 * Repro matches the bypass-cap style case from the issue screenshot (C14/C15).
 */
test("example35 before/after mergeParallelTracesSolver", () => {
  const inputTracePaths = cloneInputTracePaths(
    preMergeTraces as SolvedTracePath[],
  )

  const mergeSolver = new MergeParallelTracesSolver({
    inputProblem: inputProblem as any,
    inputTracePaths,
  })

  expect(mergeSolver.solved).toBe(false)
  expect(Object.keys(mergeSolver.correctedTraceMap)).toHaveLength(2)

  expect(mergeSolver).toMatchSolverSnapshot(
    import.meta.path,
    "before-mergeParallelTraces",
  )

  mergeSolver.solve()

  expect(mergeSolver.solved).toBe(true)
  expect(Object.keys(mergeSolver.correctedTraceMap)).toHaveLength(2)

  const traceA = mergeSolver.correctedTraceMap["trace-a"]!
  const traceB = mergeSolver.correctedTraceMap["trace-b"]!

  // Internal horizontal runs align to y=1 (same Y), pin legs keep their offset
  expect(traceA.tracePath[1]!.y).toBe(1)
  expect(traceA.tracePath[2]!.y).toBe(1)
  expect(traceB.tracePath[1]!.y).toBe(1)
  expect(traceB.tracePath[2]!.y).toBe(1)
  expect(traceB.tracePath[0]!.y).toBe(0.12)
  expect(traceB.tracePath[3]!.y).toBe(0.12)

  expect(mergeSolver).toMatchSolverSnapshot(
    import.meta.path,
    "after-mergeParallelTraces",
  )
})

test("example35 full pipeline", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
