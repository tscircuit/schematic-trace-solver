import { expect, test } from "bun:test"
import { TraceCombineSolver } from "lib/solvers/TraceCombineSolver/TraceCombineSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
}

test("TraceCombineSolver combines close same-net parallel segments", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "a-b",
      dcConnNetId: "n1",
      globalConnNetId: "g1",
      pins: [
        { pinId: "a", chipId: "c1", x: 0, y: 0 },
        { pinId: "b", chipId: "c2", x: 5, y: 0 },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["a-b"],
      pinIds: ["a", "b"],
    },
    {
      mspPairId: "c-d",
      dcConnNetId: "n2",
      globalConnNetId: "g1",
      pins: [
        { pinId: "c", chipId: "c3", x: 1, y: 0.05 },
        { pinId: "d", chipId: "c4", x: 4, y: 0.05 },
      ],
      tracePath: [
        { x: 1, y: 0.05 },
        { x: 4, y: 0.05 },
      ],
      mspConnectionPairIds: ["c-d"],
      pinIds: ["c", "d"],
    },
  ]

  const solver = new TraceCombineSolver({
    inputProblem,
    traces,
    combineDistance: 0.1,
  })
  solver.solve()

  const output = solver.getOutput().traces
  const combined = output.find((t) => t.mspPairId === "c-d")!

  expect(combined.tracePath[0]!.y).toBe(0)
  expect(combined.tracePath[1]!.y).toBe(0)
})
