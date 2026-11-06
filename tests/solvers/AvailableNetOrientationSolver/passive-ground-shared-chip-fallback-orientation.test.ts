import { expect, test } from "bun:test"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectsOverlap } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import inputProblem from "tests/repros/assets/repro-esp8684-passive-net-label-orientation.input.json"

test("falls back to shifted secondary orientation when a passive shares its chip with a ground label", () => {
  const problem: InputProblem = JSON.parse(JSON.stringify(inputProblem))
  const solver = new SchematicTracePipelineSolver(problem)
  solver.solve()

  const labels = solver.netLabelToTraceSolver!.getOutput().netLabelPlacements
  const r3Pad1Label = labels.find(
    (label) =>
      label.netId === "Net_R3_Pad1" &&
      label.pinIds.includes("schematic_port_158"),
  )

  expect(r3Pad1Label).toBeDefined()
  expect(problem.availableNetLabelOrientations[r3Pad1Label!.netId!]!).toContain(
    r3Pad1Label!.orientation,
  )

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
