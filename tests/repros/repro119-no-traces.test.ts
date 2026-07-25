import { expect, test } from "bun:test"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import {
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro119-no-traces.input.json"

const getRenderedFallbackLabelBounds = ({
  anchorPoint,
  orientation,
  text,
}: {
  anchorPoint: { x: number; y: number }
  orientation: "x+" | "x-" | "y+" | "y-"
  text: string
}) => {
  const width = text.length * 0.12 + 0.12
  const height = 0.2
  return getRectBounds(
    getCenterFromAnchor(anchorPoint, orientation, width, height),
    width,
    height,
  )
}

test("repro119 trace avoids the rendered U1_pin4 fallback label", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const traces = solver.netLabelTraceCollisionSolver!.getOutput().traces
  const netLabelPlacements =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const trace = traces.find(
    (candidate) =>
      candidate.pinIds.includes("schematic_port_12") &&
      candidate.pinIds.includes("schematic_port_6"),
  )
  const label = netLabelPlacements.find(
    (candidate) =>
      candidate.netId === ".U2 > .pin2 to U1.pin4" &&
      Math.abs(candidate.anchorPoint.x - -3.52) < 1e-6,
  )

  expect(trace).toBeDefined()
  expect(label).toBeDefined()
  expect(
    isPathCollidingWithObstacles(trace!.tracePath, [
      getRenderedFallbackLabelBounds({
        anchorPoint: label!.anchorPoint,
        orientation: label!.orientation,
        text: "U1_pin4",
      }),
    ]),
  ).toBe(false)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
