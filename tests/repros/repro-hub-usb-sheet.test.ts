import { expect, test } from "bun:test"
import { isVerticalLabelAtSameNetRailTap } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-hub-usb-sheet.input.json"

// Captured from @tsci/mohan-bee.hub 1.0.12 using @tscircuit/core 0.0.1816.
// Only opaque schematic component IDs were replaced with unique source names.
test("repro hub USB sheet schematic trace routing", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  const groundNetIds = new Set(
    inputProblem.netConnections
      .filter((connection) => connection.isGround)
      .map((connection) => connection.netId),
  )
  const tappedDownwardGroundLabels = output.netLabelPlacements.filter(
    (label) =>
      label.orientation === "y-" &&
      label.netId !== undefined &&
      groundNetIds.has(label.netId) &&
      isVerticalLabelAtSameNetRailTap({
        anchor: label.anchorPoint,
        traces: output.traces.filter(
          (trace) => trace.globalConnNetId === label.globalConnNetId,
        ),
      }),
  )

  expect(tappedDownwardGroundLabels).toHaveLength(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
