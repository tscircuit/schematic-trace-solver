import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceSegmentMergingSolver } from "lib/solvers/TraceSegmentMergingSolver/TraceSegmentMergingSolver"

const pin = (pinId: string, x: number, y: number) => ({
  pinId,
  x,
  y,
  chipId: pinId.split(".")[0]!,
})

test("merges close trace segments on the same net", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "a-b",
      dcConnNetId: "N1",
      globalConnNetId: "N1",
      pins: [pin("A.1", 0, 0), pin("B.1", 1, 0)],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["a-b"],
      pinIds: ["A.1", "B.1"],
    },
    {
      mspPairId: "c-d",
      dcConnNetId: "N1",
      globalConnNetId: "N1",
      pins: [pin("C.1", 1.05, 0), pin("D.1", 2, 0)],
      tracePath: [
        { x: 1.05, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["c-d"],
      pinIds: ["C.1", "D.1"],
    },
    {
      mspPairId: "e-f",
      dcConnNetId: "N2",
      globalConnNetId: "N2",
      pins: [pin("E.1", 10, 0), pin("F.1", 11, 0)],
      tracePath: [
        { x: 10, y: 0 },
        { x: 11, y: 0 },
      ],
      mspConnectionPairIds: ["e-f"],
      pinIds: ["E.1", "F.1"],
    },
  ]

  const solver = new TraceSegmentMergingSolver({
    traces,
    maxEndpointDistance: 0.1,
  })
  solver.solve()

  const output = solver.getOutput().traces
  expect(output).toHaveLength(2)
  expect(output[0]!.mspConnectionPairIds).toEqual(["a-b", "c-d"])
  expect(output[0]!.pinIds).toEqual(["A.1", "B.1", "C.1", "D.1"])
  expect(output[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1.05, y: 0 },
    { x: 2, y: 0 },
  ])
})

test("does not merge close trace segments on different nets", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "a-b",
      dcConnNetId: "N1",
      globalConnNetId: "N1",
      pins: [pin("A.1", 0, 0), pin("B.1", 1, 0)],
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["a-b"],
      pinIds: ["A.1", "B.1"],
    },
    {
      mspPairId: "c-d",
      dcConnNetId: "N2",
      globalConnNetId: "N2",
      pins: [pin("C.1", 1.05, 0), pin("D.1", 2, 0)],
      tracePath: [
        { x: 1.05, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["c-d"],
      pinIds: ["C.1", "D.1"],
    },
  ]

  const solver = new TraceSegmentMergingSolver({
    traces,
    maxEndpointDistance: 0.1,
  })
  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})
