import { getOrthogonalMinimumSpanningTree } from "lib/solvers/MspConnectionPairSolver/getMspConnectionPairsFromPins"
import { test, expect } from "bun:test"
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
  ).toMatchInlineSnapshot(`
    "B->A
    C->B
    D->C"
  `)
})
