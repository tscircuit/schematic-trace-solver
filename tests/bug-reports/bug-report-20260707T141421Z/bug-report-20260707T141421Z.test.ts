import { getAdverseTravelToRail } from "lib/solvers/LongDistancePairSolver/getAdverseTravelToRail"
import { expect, test } from "bun:test"
import { doesPathRunAlongChipBoundary } from "lib/solvers/Example28Solver/doesPathRunAlongChipBoundary"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import inputProblem from "./bug-report-20260707T141421Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260707T141421Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const chipObstacles = getObstacleRects(solver.inputProblem)
  const rLoadToC2Trace = solver.netLabelNetLabelCollisionSolver!.traces.find(
    (trace) =>
      trace.pinIds.includes("R_LOAD.2") && trace.pinIds.includes("C2.2"),
  )

  expect(
    doesPathRunAlongChipBoundary(rLoadToC2Trace!.tracePath, chipObstacles),
  ).toBe(false)
  // Both terminals descend to the shared GND anchor, despite their different heights.
  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundTrace = output.traces.find(
    (trace) => trace.pinIds.includes("V_IN.2") && trace.pinIds.includes("C1.2"),
  )
  expect(groundTrace).toBeDefined()
  const groundLabel = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("V_IN.2"),
  )!
  expect(groundLabel.orientation).toBe("y-")
  for (const pin of groundTrace!.pins) {
    expect(
      getAdverseTravelToRail({
        paths: [groundTrace!.tracePath],
        source: pin,
        anchors: [groundLabel.anchorPoint],
        orientation: "y-",
      }),
    ).toBe(0)
  }
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
