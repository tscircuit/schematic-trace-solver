import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { boundsOverlap } from "lib/utils/textBoxBounds"
import inputProblem from "./bug-report-20260902T092425Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260902T092425Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements
  const groundLabel = labels.find(
    (label) =>
      label.netId === "GND" &&
      label.pinIds.includes("schematic_port_5") &&
      label.pinIds.includes("schematic_port_7"),
  )!
  const vraLabels = labels.filter(
    (label) =>
      (label.netId === "AUDIO_VRA1" || label.netId === "AUDIO_VRA2") &&
      (label.pinIds.includes("schematic_port_4") ||
        label.pinIds.includes("schematic_port_6")),
  )

  expect(groundLabel).toBeDefined()
  expect(vraLabels).toHaveLength(2)
  expect(vraLabels.find((label) => label.netId === "AUDIO_VRA2")).toMatchObject(
    {
      orientation: "y+",
      width: 1.32,
      height: 0.42,
    },
  )
  for (const vraLabel of vraLabels) {
    expect(
      boundsOverlap(
        getRectBounds(
          groundLabel.center,
          groundLabel.width,
          groundLabel.height,
        ),
        getRectBounds(vraLabel.center, vraLabel.width, vraLabel.height),
      ),
    ).toBe(false)
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
