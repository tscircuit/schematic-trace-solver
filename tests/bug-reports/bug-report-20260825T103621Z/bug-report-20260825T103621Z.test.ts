import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "./bug-report-20260825T103621Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260825T103621Z", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
  )

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  expect(getOutputLabelCollisions(output)).toEqual([])

  const gnd44 = output.netLabelPlacements.find(
    (label) =>
      label.netId === "GND" &&
      label.pinIds.includes("schematic_port_44") &&
      label.pinIds.includes("schematic_port_13"),
  )
  expect(gnd44).toBeDefined()
  expect(gnd44?.orientation).toBe("y-")

  const mainChip = inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_0",
  )!
  const chipMinX = mainChip.center.x - mainChip.width / 2
  const chipMaxX = mainChip.center.x + mainChip.width / 2
  const chipMinY = mainChip.center.y - mainChip.height / 2
  const chipMaxY = mainChip.center.y + mainChip.height / 2

  const gndBounds = getRectBounds(gnd44!.center, gnd44!.width, gnd44!.height)
  const overlapWidth = Math.max(
    0,
    Math.min(gndBounds.maxX, chipMaxX) - Math.max(gndBounds.minX, chipMinX),
  )
  const overlapHeight = Math.max(
    0,
    Math.min(gndBounds.maxY, chipMaxY) - Math.max(gndBounds.minY, chipMinY),
  )
  expect(overlapWidth * overlapHeight).toBe(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
