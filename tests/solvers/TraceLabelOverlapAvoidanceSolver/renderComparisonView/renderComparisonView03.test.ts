import { expect, test } from "bun:test"
import {
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import inputData from "../../../assets/3.input.json"

test("SingleOverlapSolver-to-TraceCleanupSolver snapshot", () => {
  // Convert targetTraceIds to Set
  // @ts-expect-error
  inputData.traceCleanupSolver.targetTraceIds = new Set(
    inputData.traceCleanupSolver.targetTraceIds,
  )

  // Convert mergedLabelNetIdMap arrays to Sets
  // @ts-expect-error
  inputData.traceCleanupSolver.mergedLabelNetIdMap = Object.fromEntries(
    Object.entries(inputData.traceCleanupSolver.mergedLabelNetIdMap).map(
      ([key, value]) => [key, new Set(value)],
    ),
  )

  const solver1 = new TraceCleanupSolver(inputData.traceCleanupSolver as any)
  const solver2 = new SingleOverlapSolver(inputData.singleOverlapSolver as any)
  solver1.solve()
  solver2.solve()
  const sideBySide = getSvgFromGraphicsObject(
    stackGraphicsHorizontally([solver2.visualize(), solver1.visualize()], {
      titles: ["SingleOverlapSolver", "TraceCleanupSolver"],
    }),
    {
      backgroundColor: "white",
    },
  )
  expect(sideBySide).toMatchSvgSnapshot(import.meta.path)
})
