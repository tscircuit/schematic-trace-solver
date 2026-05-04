import { expect, test } from "bun:test"
import { getOrthogonalMinimumSpanningTree } from "lib/solvers/MspConnectionPairSolver/get-msp-connection-pairs-from-pins"
import type { InputPin } from "lib/types/InputProblem"

test("getOrthogonalMinimumSpanningTree", () => {
  const pins: InputPin[] = [
    { x: 0, y: 0, pinId: "A" },
    { x: 1, y: 1, pinId: "B" },
    { x: 10, y: 10, pinId: "C" },
    { x: 11, y: 11, pinId: "D" },
  ]
  const msp = getOrthogonalMinimumSpanningTree(pins)
  expect(
    msp
      .map(([a, b]) => `${a}->${b}`)
      .sort()
      .join("\n"),
  ).toBe("B->A\nC->B\nD->C")
})
