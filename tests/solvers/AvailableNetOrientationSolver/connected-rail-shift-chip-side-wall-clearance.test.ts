import { expect, test } from "bun:test"
import { getOutputLabelCollisions } from "lib/solvers/InlineNetLabelSolver/getOutputLabelCollisions"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import bugReport877 from "tests/bug-reports/bug-report-20260825T103621Z/bug-report-20260825T103621Z.json"
import bugReport908 from "tests/bug-reports/bug-report-20260826T072956Z/bug-report-20260826T072956Z.json"

test.each([
  ["bug-report-20260825T103621Z (#877)", bugReport877],
  ["bug-report-20260826T072956Z (#908)", bugReport908],
])(
  "keeps connected-rail-shift vertical GND labels outside chip side walls in %s",
  (_label, rawInput) => {
    const problem: InputProblem = JSON.parse(JSON.stringify(rawInput))
    const solver = new SchematicTracePipelineSolver(problem)
    solver.solve()

    const output = solver.inlineNetLabelSolver?.getOutput()
    expect(output).toBeDefined()
    if (!output) return

    expect(getOutputLabelCollisions(output)).toEqual([])

    const gnd44 = output.netLabelPlacements.find(
      (placement) =>
        placement.netId === "GND" &&
        placement.pinIds.includes("schematic_port_44") &&
        placement.pinIds.includes("schematic_port_13"),
    )
    expect(gnd44).toBeDefined()
    expect(gnd44?.orientation).toBe("y-")

    const mainChip = problem.chips.find(
      (chip) => chip.chipId === "schematic_component_0",
    )
    expect(mainChip).toBeDefined()
    if (!gnd44 || !mainChip) return

    const chipMinX = mainChip.center.x - mainChip.width / 2
    const chipMaxX = mainChip.center.x + mainChip.width / 2
    const chipMinY = mainChip.center.y - mainChip.height / 2
    const chipMaxY = mainChip.center.y + mainChip.height / 2

    const gndBounds = getRectBounds(gnd44.center, gnd44.width, gnd44.height)
    const overlapWidth = Math.max(
      0,
      Math.min(gndBounds.maxX, chipMaxX) - Math.max(gndBounds.minX, chipMinX),
    )
    const overlapHeight = Math.max(
      0,
      Math.min(gndBounds.maxY, chipMaxY) - Math.max(gndBounds.minY, chipMinY),
    )
    expect(overlapWidth * overlapHeight).toBe(0)
  },
)
