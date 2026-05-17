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
 * Issue #34: two parallel same-net traces (y=1 and y=1.1) merge into one.
 * Uses explicit pre-merge traces so before/after snapshots differ by geometry,
 * not only stroke color between pipeline stages.
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
  expect(Object.keys(mergeSolver.correctedTraceMap)).toHaveLength(1)
  expect(mergeSolver.getOutput().traces[0]!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 4, y: 1 },
  ])

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
