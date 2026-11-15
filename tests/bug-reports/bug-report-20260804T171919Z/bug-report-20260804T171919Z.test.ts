import { expect, test } from "bun:test"
import { rectsOverlap } from "lib/solvers/AvailableNetOrientationSolver/geometry"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"
import inputProblem from "./bug-report-20260804T171919Z.json"
import "tests/fixtures/matcher"

test("bug-report-20260804T171919Z", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver.solved).toBe(true)
  const output = solver.netLabelToTraceSolver!.getOutput()

  const v3v3At154 = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_154"),
  )!
  const gndAt152 = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_152"),
  )!
  const bootRAt123 = output.netLabelPlacements.find((label) =>
    label.pinIds.includes("schematic_port_123"),
  )!

  expect(v3v3At154.orientation).toBe("y+")
  expect(gndAt152.orientation).toBe("y-")
  expect(
    rectsOverlap(
      getRectBounds(v3v3At154.center, v3v3At154.width, v3v3At154.height),
      getRectBounds(gndAt152.center, gndAt152.width, gndAt152.height),
    ),
  ).toBe(false)
  expect(
    rectIntersectsAnyTextBox(
      getRectBounds(bootRAt123.center, bootRAt123.width, bootRAt123.height),
      inputProblem as any,
    ),
  ).toBe(false)

  for (let i = 0; i < output.netLabelPlacements.length; i++) {
    const first = output.netLabelPlacements[i]!
    const firstBounds = getRectBounds(first.center, first.width, first.height)
    expect(rectIntersectsAnyTextBox(firstBounds, inputProblem as any)).toBe(
      false,
    )
    for (let j = i + 1; j < output.netLabelPlacements.length; j++) {
      const second = output.netLabelPlacements[j]!
      const secondBounds = getRectBounds(
        second.center,
        second.width,
        second.height,
      )
      expect(rectsOverlap(firstBounds, secondBounds)).toBe(false)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
