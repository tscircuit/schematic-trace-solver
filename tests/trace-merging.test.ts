import { test, expect } from "bun:test"
import { TraceSegmentMergingSolver } from "lib/solvers/TraceSegmentMergingSolver/TraceSegmentMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("TraceSegmentMergingSolver should merge collinear touching segments", () => {
  const inputProblem: InputProblem = {
    chips: [],
    netConnections: [],
    directConnections: [],
  } as any

  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      pins: [] as any,
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["pin1", "pin2"],
    },
    {
      mspPairId: "pair2",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      pins: [] as any,
      tracePath: [
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["pin2", "pin3"],
    },
  ]

  const solver = new TraceSegmentMergingSolver({
    allTraces: traces,
    inputProblem,
  })

  solver.step()
  const output = solver.getOutput()

  expect(output.traces).toHaveLength(1)
  expect(output.traces[0].tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ])
  expect(output.traces[0].pinIds).toContain("pin1")
  expect(output.traces[0].pinIds).toContain("pin2")
  expect(output.traces[0].pinIds).toContain("pin3")
})

test("TraceSegmentMergingSolver should merge segments within threshold", () => {
  const inputProblem: InputProblem = {
    chips: [],
    netConnections: [],
    directConnections: [],
  } as any

  const traces: SolvedTracePath[] = [
    {
      mspPairId: "pair1",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      pins: [] as any,
      tracePath: [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ],
      mspConnectionPairIds: ["pair1"],
      pinIds: ["pin1", "pin2"],
    },
    {
      mspPairId: "pair2",
      globalConnNetId: "net1",
      dcConnNetId: "net1",
      pins: [] as any,
      tracePath: [
        { x: 5.05, y: 0 }, // Slightly offset but within 0.1 threshold
        { x: 10, y: 0 },
      ],
      mspConnectionPairIds: ["pair2"],
      pinIds: ["pin2", "pin3"],
    },
  ]

  const solver = new TraceSegmentMergingSolver({
    allTraces: traces,
    inputProblem,
    mergingThreshold: 0.1,
  })

  solver.step()
  const output = solver.getOutput()

  expect(output.traces).toHaveLength(1)
  expect(output.traces[0].tracePath).toHaveLength(2)
  expect(output.traces[0].tracePath[0].x).toBe(0)
  expect(output.traces[0].tracePath[1].x).toBe(10)
})
