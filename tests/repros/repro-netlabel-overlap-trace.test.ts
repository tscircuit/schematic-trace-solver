import { expect, test } from "bun:test"
import { traceCrossesBoundsInterior } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import {
  getTraceCorners,
  rectsOverlap,
} from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./assets/repro-netlabel-overlap-trace.input.json"
import "tests/fixtures/matcher"

// Regression (from @tscircuit/core repro147): a GND net label ends up overlapping
// the B1/SW1 junction trace instead of being placed clear of it.
test("repro147 netlabel overlaps trace", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const output = solver.sameNetJunctionAlignmentSolver!.getOutput()
  const groundLabel = output.netLabelPlacements.find(
    (label) => label.netId === "GND",
  )!
  const groundTrace = output.traces.find((trace) =>
    groundLabel.mspConnectionPairIds.includes(trace.mspPairId),
  )!
  const groundLabelBounds = getRectBounds(
    groundLabel.center,
    groundLabel.width,
    groundLabel.height,
  )

  expect(getTraceCorners(groundTrace.tracePath)).toContainEqual(
    groundLabel.anchorPoint,
  )
  expect(
    inputProblem.chips.some((chip) =>
      rectsOverlap(
        groundLabelBounds,
        getRectBounds(chip.center, chip.width, chip.height),
      ),
    ),
  ).toBe(false)
  expect(
    traceCrossesBoundsInterior(
      groundLabelBounds,
      Object.fromEntries(
        output.traces.map((trace) => [trace.mspPairId, trace]),
      ),
    ),
  ).toBe(false)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
