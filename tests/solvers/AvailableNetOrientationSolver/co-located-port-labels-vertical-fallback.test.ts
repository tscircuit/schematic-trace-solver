import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "tests/bug-reports/bug-report-20260804T171919Z/bug-report-20260804T171919Z.json"

test("separates co-located port-only labels and finds valid vertical fallback columns past crossing traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)
  solver.solve()

  const placements =
    solver.netLabelToTraceSolver?.getOutput().netLabelPlacements ?? []
  const port61 = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_61"),
  )
  const port107 = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_107"),
  )
  const port152 = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_152"),
  )
  const port154 = placements.find((nl) =>
    nl.pinIds.includes("schematic_port_154"),
  )

  expect(port61?.orientation).toBe("y+")
  expect(port107?.orientation).toBe("y-")
  expect(port152?.orientation).toBe("y-")
  expect(port154?.orientation).toBe("y+")
  expect(
    rectsOverlap(
      getRectBounds(port152!.center, port152!.width, port152!.height),
      getRectBounds(port154!.center, port154!.width, port154!.height),
    ),
  ).toBe(false)
})
