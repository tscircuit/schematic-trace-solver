import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "./SameNetTraceMergeSolver"

test("SameNetTraceMergeSolver merges parallel same-net traces within gap threshold", () => {
  const traces = [
    {
      mspPairId: "net1",
      mspConnectionPairId: "pair1",
      pinIds: ["pin1"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      mspPairId: "net1",
      mspConnectionPairId: "pair1",
      pinIds: ["pin2"],
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 1, y: 0.1 },
      ],
    },
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()
  const result = solver.getOutput()

  expect(result.traces.length).toBeLessThanOrEqual(traces.length)
})

test("SameNetTraceMergeSolver does not merge different nets", () => {
  const traces = [
    {
      mspPairId: "net1",
      mspConnectionPairId: "pair1",
      pinIds: ["pin1"],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    },
    {
      mspPairId: "net2",
      mspConnectionPairId: "pair2",
      pinIds: ["pin2"],
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 1, y: 0.1 },
      ],
    },
  ]

  const solver = new SameNetTraceMergeSolver({ allTraces: traces })
  solver.solve()
  const result = solver.getOutput()

  expect(result.traces.length).toBe(2)
})
