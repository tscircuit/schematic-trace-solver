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
// initially leaves Net_U3F_VRA2 in the pin-facing x+ orientation. The
// orientation solver must restore its y+ rail constraint and keep GND clear of
// VRA2 and P1V8 without widening the horizontal label placement.
test("keeps Trellis Core GND clear of adjacent analog net labels", () => {
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
    orientation: "y+",
    width: 1.56,
    height: 0.42,
  })
  expect(groundLabel.orientation).toBe("y-")
  expect(
    getOverlapArea(getLabelBounds(groundLabel), getLabelBounds(vra2Label)),
  ).toBe(0)
  expect(
    getOverlapArea(getLabelBounds(groundLabel), getLabelBounds(p1v8Label)),
  ).toBe(0)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("converts both Trellis Core P1V8 endpoints after clearing label collisions", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as InputProblem)

  solver.solve()

  // The U3-side VRA2 label previously overlapped the inline P1V8 text. That
  // blocked conversion of both endpoints, including the distant upward pin.
  const output = solver.netLabelToTraceSolver!.getOutput()
  const inlineP1v8Labels = output.inlineNetLabelPlacements.filter(
    (label) => label.netId === "P1V8",
  )
  expect(inlineP1v8Labels).toHaveLength(2)
  expect(inlineP1v8Labels).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ pinIds: ["schematic_port_0"], axis: "x" }),
      expect.objectContaining({ pinIds: ["schematic_port_10"], axis: "y" }),
    ]),
  )
  expect(
    output.netLabelPlacements.some((label) => label.netId === "P1V8"),
  ).toBe(false)
  for (const label of inlineP1v8Labels) {
    const pin = inputProblem.chips
      .flatMap((chip) => chip.pins)
      .find((pin) => pin.pinId === label.pinIds[0])!
    expect(label.stubTracePath?.[0]).toEqual({ x: pin.x, y: pin.y })
  }
})

test("keeps Trellis Core P1V8 anchored when inline labels are disabled", () => {
  const problem = structuredClone(inputProblem) as InputProblem
  problem.netConnections.find(
    (connection) => connection.netId === "P1V8",
  )!.allowInlineNetLabel = false
  const solver = new SchematicTracePipelineSolver(problem)

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(output.inlineNetLabelPlacements).toHaveLength(0)
  expect(
    output.netLabelPlacements
      .filter((label) => label.netId === "P1V8")
      .flatMap((label) => label.pinIds)
      .sort(),
  ).toEqual(["schematic_port_0", "schematic_port_10"])
})
