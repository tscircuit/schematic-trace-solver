import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-trellis-core-gnd-net-label-overlap.input.json"

const getLabelBounds = (label: NetLabelPlacement) => ({
  minX: label.center.x - label.width / 2,
  maxX: label.center.x + label.width / 2,
  minY: label.center.y - label.height / 2,
  maxY: label.center.y + label.height / 2,
})

const getOverlapArea = (
  first: ReturnType<typeof getLabelBounds>,
  second: ReturnType<typeof getLabelBounds>,
) => {
  const width =
    Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX)
  const height =
    Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY)

  return width > 0 && height > 0 ? width * height : 0
}

// Captured from @tscircuit/core repro175. The dense T113 analog-pin column
// forces Net_U3F_VRA2 to fall back from its requested y+ rail orientation to
// the pin-facing x+ orientation. The fallback reports a 0.42 x 0.20 label box
// even though the rendered text is 1.56 wide. The pipeline then finishes with
// the U3-side GND label overlapping both VRA2 and P1V8.
//
// The connector-crossing cleanup gives the following collision pass enough room
// to place the GND label without overlapping either neighboring rail label.
test("keeps the Trellis Core GND label clear of VRA2 and P1V8", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  const labels =
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements
  const vra2Label = labels.find(
    (label) =>
      label.netId === "Net_U3F_VRA2" &&
      label.pinIds.includes("schematic_port_1"),
  )!
  const p1v8Label = labels.find(
    (label) =>
      label.netId === "P1V8" && label.pinIds.includes("schematic_port_0"),
  )!
  const groundLabel = labels.find(
    (label) =>
      label.netId === "GND" &&
      label.pinIds.includes("schematic_port_2") &&
      label.pinIds.includes("schematic_port_4"),
  )!

  expect(vra2Label).toBeDefined()
  expect(p1v8Label).toBeDefined()
  expect(groundLabel).toBeDefined()
  expect(vra2Label).toMatchObject({
    orientation: "x+",
    width: 0.42,
    height: 0.2,
  })
  expect(
    getOverlapArea(getLabelBounds(groundLabel), getLabelBounds(vra2Label)),
  ).toBe(0)
  expect(
    getOverlapArea(getLabelBounds(groundLabel), getLabelBounds(p1v8Label)),
  ).toBe(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
