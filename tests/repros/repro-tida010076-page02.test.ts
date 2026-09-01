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
  expect(
    inputProblem.netConnections
      .filter((connection) => connection.isGround)
      .map((connection) => connection.netId)
      .sort(),
  ).toEqual(["NET_AGND", "NET_GND"])
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
  expect(Math.abs(j5AgndLabel.anchorPoint.x - j5GroundPins[0]!.x)).toBeCloseTo(
    0.2,
  )

  const powerConnectorPinPairs = [
    ["schematic_port_50", "schematic_port_266"],
    ["schematic_port_53", "schematic_port_268"],
    ["schematic_port_54", "schematic_port_270"],
    ["schematic_port_55", "schematic_port_264"],
  ]
  const output = solver.inlineNetLabelSolver!.getOutput()
  const clusteredPowerNetIds = new Set(
    inputProblem.directConnections
      .filter((connection) =>
        powerConnectorPinPairs.some((pair) =>
          pair.every((pinId) => connection.pinIds.includes(pinId)),
        ),
      )
      .map((connection) => connection.netId),
  )

  for (const pinPair of powerConnectorPinPairs) {
    expect(
      output.traces.some((trace) =>
        pinPair.every((pinId) => trace.pinIds.includes(pinId)),
      ),
    ).toBe(true)
  }
  expect(
    output.netLabelPlacements.filter((label) =>
      clusteredPowerNetIds.has(label.netId),
    ),
  ).toEqual([])

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
