import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblem from "./assets/repro-555-c1-timing-label-c3-overlap.input.json"

// Captured from @tscircuit/core 0.0.1803. C1 and C3 leave less vertical
// clearance than the C1-side TIMING label needs. The placement search rejects
// its horizontal candidates, then falls back to a vertical label that overlaps
// the C3 schematic component.
//
// This test pins the current buggy output. A fix should change the overlap
// assertion to expect 0 and update the visual snapshot.
test("repro C1 TIMING label overlaps nearby C3", () => {
  const solver = new SchematicTracePipelineSolver(
    inputProblem as unknown as InputProblem,
    { hideRatsNet: true },
  )

  solver.solve()

  expect(inputProblem.chips).toHaveLength(9)
  expect(
    inputProblem.netConnections
      .find((connection) => connection.netId === "TIMING")
      ?.pinIds.includes("schematic_port_16"),
  ).toBe(true)
  expect(
    inputProblem.netConnections
      .find((connection) => connection.netId === "GND")
      ?.pinIds.includes("schematic_port_17"),
  ).toBe(true)
  expect(
    inputProblem.directConnections.some((connection) =>
      connection.pinIds.some(
        (pinId) =>
          pinId === "schematic_port_16" || pinId === "schematic_port_17",
      ),
    ),
  ).toBe(false)

  const c1TimingLabel = solver
    .inlineNetLabelSolver!.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.netId === "TIMING" && label.pinIds.includes("schematic_port_16"),
    )
  const c3 = solver.inputProblem.chips.find(
    (chip) => chip.chipId === "schematic_component_7",
  )!

  expect(c1TimingLabel).toBeDefined()
  const labelBounds = {
    minX: c1TimingLabel!.center.x - c1TimingLabel!.width / 2,
    maxX: c1TimingLabel!.center.x + c1TimingLabel!.width / 2,
    minY: c1TimingLabel!.center.y - c1TimingLabel!.height / 2,
    maxY: c1TimingLabel!.center.y + c1TimingLabel!.height / 2,
  }
  const c3Bounds = {
    minX: c3.center.x - c3.width / 2,
    maxX: c3.center.x + c3.width / 2,
    minY: c3.center.y - c3.height / 2,
    maxY: c3.center.y + c3.height / 2,
  }
  const overlapWidth =
    Math.min(labelBounds.maxX, c3Bounds.maxX) -
    Math.max(labelBounds.minX, c3Bounds.minX)
  const overlapHeight =
    Math.min(labelBounds.maxY, c3Bounds.maxY) -
    Math.max(labelBounds.minY, c3Bounds.minY)

  expect(overlapWidth).toBeGreaterThan(0)
  expect(overlapHeight).toBeGreaterThan(0)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
