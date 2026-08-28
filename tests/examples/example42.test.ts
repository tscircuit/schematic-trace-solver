import { expect, test } from "bun:test"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "../assets/example42.json"
import "tests/fixtures/matcher"

const LABEL_INTERIOR_EPSILON = 1e-6
const solverInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))

test("example42", () => {
  const solver = new SchematicTracePipelineSolver(solverInput)

  solver.solve()

  const finalRoutingOutput = solver.netLabelTraceCollisionSolver!.getOutput()
  const cc1Label = finalRoutingOutput.netLabelPlacements.find(
    (label) => label.netId === "CC1",
  )!
  const cc1Trace = finalRoutingOutput.traces.find(
    (trace) => trace.userNetId === "CC1",
  )!
  const cc1LabelBounds = getRectBounds(
    cc1Label.center,
    cc1Label.width,
    cc1Label.height,
  )
  const cc1LabelInteriorBounds = {
    minX: cc1LabelBounds.minX + LABEL_INTERIOR_EPSILON,
    maxX: cc1LabelBounds.maxX - LABEL_INTERIOR_EPSILON,
    minY: cc1LabelBounds.minY + LABEL_INTERIOR_EPSILON,
    maxY: cc1LabelBounds.maxY - LABEL_INTERIOR_EPSILON,
  }
  const traceEntersCc1LabelInterior = cc1Trace.tracePath
    .slice(0, -1)
    .some((segmentStart, segmentIndex) =>
      segmentIntersectsRect(
        segmentStart,
        cc1Trace.tracePath[segmentIndex + 1]!,
        cc1LabelInteriorBounds,
      ),
    )

  expect(traceEntersCc1LabelInterior).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
