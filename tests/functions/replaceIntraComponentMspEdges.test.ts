import { expect, test } from "bun:test"
import { replaceIntraComponentMspEdges } from "lib/solvers/MspConnectionPairSolver/replaceIntraComponentMspEdges"
import type { InputProblem, PinId } from "lib/types/InputProblem"

test("replaces an avoidable intra-component MSP edge", () => {
  const pins = [
    { pinId: "U1.1", chipId: "U1", x: 0, y: 1 },
    { pinId: "U1.2", chipId: "U1", x: 0, y: 0 },
    { pinId: "C1.1", chipId: "C1", x: -2, y: 1 },
    { pinId: "R1.1", chipId: "R1", x: 2, y: 1 },
  ]
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 1, y: 0.5 },
        width: 2,
        height: 2,
        pins: pins.filter((pin) => pin.chipId === "U1"),
      },
      {
        chipId: "C1",
        center: { x: -2.5, y: 1 },
        width: 1,
        height: 1,
        pins: pins.filter((pin) => pin.chipId === "C1"),
      },
      {
        chipId: "R1",
        center: { x: 2.5, y: 1 },
        width: 1,
        height: 1,
        pins: pins.filter((pin) => pin.chipId === "R1"),
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const chipMap = Object.fromEntries(
    inputProblem.chips.map((chip) => [chip.chipId, chip]),
  )
  const pinIdMap = new Map(pins.map((pin) => [pin.pinId as PinId, pin]))

  const edges = replaceIntraComponentMspEdges({
    edges: [
      ["U1.2", "U1.1"],
      ["C1.1", "U1.1"],
      ["R1.1", "U1.1"],
    ],
    pins,
    inputProblem,
    chipMap,
    pinIdMap,
    maxDistance: 5,
  })

  expect(edges).toEqual([
    ["U1.2", "C1.1"],
    ["C1.1", "U1.1"],
    ["R1.1", "U1.1"],
  ])
})
