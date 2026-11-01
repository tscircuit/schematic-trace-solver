import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/repros/assets/repro-same-chip-ground-rail-inline-net-label.input.json"

test("keeps same-chip ground rail label in y- orientation when aligned across inline net labels", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()

  const labels = solver.netLabelToTraceSolver!.getOutput().netLabelPlacements
  const groundRailLabel = labels.find(
    (label) =>
      label.netId === "GND" && label.pinIds.includes("schematic_port_7"),
  )

  expect(groundRailLabel).toBeDefined()
  expect(groundRailLabel!.orientation).toBe("y-")
  expect(groundRailLabel!.anchorPoint.x).toBeCloseTo(-2.25)
  expect(groundRailLabel!.anchorPoint.y).toBeCloseTo(-0.6)

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i]!
    const allowed = label.netId
      ? problem.availableNetLabelOrientations[label.netId]
      : undefined
    if (allowed?.length) {
      expect(allowed).toContain(label.orientation)
    }
    for (let j = i + 1; j < labels.length; j++) {
      const other = labels[j]!
      expect(
        rectsOverlap(
          getRectBounds(label.center, label.width, label.height),
          getRectBounds(other.center, other.width, other.height),
        ),
      ).toBe(false)
    }
  }
})
