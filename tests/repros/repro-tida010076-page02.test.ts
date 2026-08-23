import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-tida010076-page02.input.json"

// Captured from the InputProblem emitted by @tscircuit/core while rendering
// TI TIDA-010076 sheet 02 (card_top). Keep this broad page-level fixture as a
// parity baseline for net-label placement changes that affect several sections.
test("repro TIDA-010076 page 02 net-label placement", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )

  expect(inputProblem.chips).toHaveLength(21)
  expect(inputProblem.directConnections).toHaveLength(13)
  expect(inputProblem.netConnections).toHaveLength(96)
  expect(inputProblem.availableNetLabelOrientations?.NET_AGND).toEqual(["y-"])

  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })
  solver.solve()

  expect(solver.solved).toBe(true)

  const j5ChipId = inputProblem.textBoxes?.find(
    (textBox) => textBox.text === "J5",
  )?.chipId
  const j5 = inputProblem.chips.find((chip) => chip.chipId === j5ChipId)!
  const j5GroundPins = j5.pins.slice(2)
  const j5GroundPinIds = new Set(j5GroundPins.map((pin) => pin.pinId))
  const j5AgndLabel = solver
    .inlineNetLabelSolver!.getOutput()
    .netLabelPlacements.find(
      (label) =>
        label.netId === "NET_AGND" &&
        label.pinIds.some((pinId) => j5GroundPinIds.has(pinId)),
    )!

  expect(j5AgndLabel.orientation).toBe("y-")
  expect(j5AgndLabel.anchorPoint.y).toBeCloseTo(
    Math.min(...j5GroundPins.map((pin) => pin.y)),
  )
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
