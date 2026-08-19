import { expect, test } from "bun:test"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("SameNetTraceMergeSolver merges parallel traces of same net", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    ports: [],
  }

  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      userNetId: undefined,
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 10 },
      ],
      mspConnectionPairIds: [],
      pinIds: []
    } as any,
    {
      mspPairId: "pair2",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      userNetId: undefined,
      tracePath: [
        { x: 0.2, y: 2 },
        { x: 0.2, y: 8 },
      ],
      mspConnectionPairIds: [],
      pinIds: []
    } as any
  ]

  const solver = new SameNetTraceMergeSolver({
    inputProblem,
    traces,
    maxMergeDistance: 0.5
  })
  solver.solve()

  const output = solver.getOutput().traces
  
  // pair2 should be shifted to x = 0 (or pair1 shifted to 0.2)
  expect(output[0].tracePath[0].x).toEqual(output[1].tracePath[0].x)
})
