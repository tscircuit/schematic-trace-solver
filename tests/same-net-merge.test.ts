// @ts-nocheck
import { test, expect } from "bun:test"
import { SameNetTraceMergeSolver } from "../lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"

test("merge parallel same-net segments", () => {
  const mockTraces = [
    {
      source_net_id: "net_1",
      edges: [
        { from: { x: 0, y: 0 }, to: { x: 10, y: 0 } },
        { from: { x: 0, y: 0.05 }, to: { x: 10, y: 0.05 } },
      ],
    },
  ]

  const solver = new SameNetTraceMergeSolver({
    allTraces: mockTraces,
    directConnections: [],
    chips: [],
    components: [],
    obstacles: [],
  } as any)

  solver.solve()

  const output = solver.getOutput().traces

  expect(output[0].edges.length).toBe(1)
})
