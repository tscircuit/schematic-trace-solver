import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetTraces"

test("mergeSameNetTraces snaps close parallel same-net horizontal segments", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      globalConnNetId: "netA",
      dcConnNetId: "netA",
      pins: [] as any,
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 10.2 },
        { x: 5, y: 10.2 },
        { x: 5, y: 5 },
      ],
      mspConnectionPairIds: [],
      pinIds: [],
    },
    {
      mspPairId: "trace2",
      globalConnNetId: "netA",
      dcConnNetId: "netA",
      pins: [] as any,
      tracePath: [
        { x: 2, y: 0 },
        { x: 2, y: 9.8 },
        { x: 8, y: 9.8 },
        { x: 8, y: 5 },
      ],
      mspConnectionPairIds: [],
      pinIds: [],
    },
  ]

  const inputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const result = mergeSameNetTraces(traces, inputProblem, [], {}, 0.1)

  // Both should snap to y = 9.8 (coordinate of the longer segment)
  expect(result[0].tracePath[1].y).toBe(9.8)
  expect(result[0].tracePath[2].y).toBe(9.8)
  expect(result[1].tracePath[1].y).toBe(9.8)
  expect(result[1].tracePath[2].y).toBe(9.8)

  // Start and end points of the path must remain fixed
  expect(result[0].tracePath[0]).toEqual({ x: 0, y: 0 })
  expect(result[0].tracePath[3]).toEqual({ x: 5, y: 5 })
  expect(result[1].tracePath[0]).toEqual({ x: 2, y: 0 })
  expect(result[1].tracePath[3]).toEqual({ x: 8, y: 5 })
})
