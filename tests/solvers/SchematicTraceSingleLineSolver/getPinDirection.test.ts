import { expect, test } from "bun:test"
import { getPinDirection } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/getPinDirection"
import type { InputChip } from "lib/types/InputProblem"

test("uses the connected pin to resolve a corner direction", () => {
  const cornerPin = { pinId: "L1.2", x: 1, y: -0.1 }
  const chip: InputChip = {
    chipId: "L1",
    center: { x: 0, y: 0 },
    width: 2,
    height: 0.2,
    pins: [cornerPin, { pinId: "L1.1", x: -1, y: -0.1 }],
  }

  expect(getPinDirection(cornerPin, chip)).toBe("y-")
  expect(
    getPinDirection(cornerPin, chip, {
      pinId: "L2.1",
      x: 3,
      y: -0.097,
    }),
  ).toBe("x+")
})
