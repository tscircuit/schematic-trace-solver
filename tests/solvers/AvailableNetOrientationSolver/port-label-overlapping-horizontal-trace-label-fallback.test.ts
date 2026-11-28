import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/bug-reports/bug-report-20260717T022934Z/bug-report-20260717T022934Z.json"

test("shifts vertical port-only label past an initially overlapping horizontal trace-anchored label (#674)", () => {
  const clonedInput: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(clonedInput)
  solver.solve()

  const placements =
    solver.netLabelToTraceSolver?.getOutput().netLabelPlacements ?? []
  const u1Pin8Ground = placements.find((nl) => nl.pinIds.includes("U1.8"))
  const sdiSdaLabel = placements.find((nl) => nl.netId === "SDI_SDA")

  expect(u1Pin8Ground).toBeDefined()
  expect(sdiSdaLabel).toBeDefined()
  if (!u1Pin8Ground || !sdiSdaLabel) return

  expect(u1Pin8Ground.orientation).toBe("y-")
  expect(
    rectsOverlap(
      getRectBounds(
        u1Pin8Ground.center,
        u1Pin8Ground.width,
        u1Pin8Ground.height,
      ),
      getRectBounds(sdiSdaLabel.center, sdiSdaLabel.width, sdiSdaLabel.height),
    ),
  ).toBe(false)
})
