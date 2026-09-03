import { expect, test } from "bun:test"
import {
  getPinDirection,
  getPinDirectionCandidates,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { InputChip } from "lib/types/InputProblem"

test("uses the connected pin to resolve a corner direction on any symbol", () => {
  const cornerPin = { pinId: "L1.2", x: 1, y: -0.1 }
  const chip: InputChip = {
    chipId: "L1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 0.2,
    pins: [
      cornerPin,
      { pinId: "L1.1", x: -1, y: -0.1 },
      { pinId: "L1.3", x: 0, y: 0.1 },
    ],
  }

  expect(getPinDirection(cornerPin, chip)).toBe("y-")
  expect(
    getPinDirection(cornerPin, chip, {
      pinId: "L2.1",
      x: 3,
      y: -0.097,
    }),
  ).toBe("x+")
  expect(
    getPinDirectionCandidates(cornerPin, chip, {
      pinId: "L2.1",
      x: 3,
      y: -0.097,
    }),
  ).toEqual(["x+", "y-"])
})

test("preserves the nearest-edge default for an almost exact corner", () => {
  const cornerPin = { pinId: "U1.1", x: -1, y: 0.9999999999999994 }
  const chip: InputChip = {
    chipId: "U1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 2,
    pins: [cornerPin],
  }

  expect(getPinDirection(cornerPin, chip)).toBe("x-")
  expect(getPinDirectionCandidates(cornerPin, chip)).toEqual(["x-", "y+"])
})
