import { test, expect } from "bun:test"
import { mergeCollinearTraces } from "lib/solvers/TraceCleanupSolver/mergeCollinearTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("mergeCollinearTraces - merge two horizontal traces on same net", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
      ],
    },
    {
      mspPairId: "trace2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["trace2"],
      pinIds: ["pin2", "pin3"],
      pins: [
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
        { pinId: "pin3", x: 2, y: 0, chipId: "chip3" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should merge into one trace
  expect(result.length).toBe(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(result[0]!.mspConnectionPairIds).toEqual(["trace1", "trace2"])
})

test("mergeCollinearTraces - merge two vertical traces on same net", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 0, y: 1, chipId: "chip2" },
      ],
    },
    {
      mspPairId: "trace2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
      mspConnectionPairIds: ["trace2"],
      pinIds: ["pin2", "pin3"],
      pins: [
        { pinId: "pin2", x: 0, y: 1, chipId: "chip2" },
        { pinId: "pin3", x: 0, y: 2, chipId: "chip3" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should merge into one trace
  expect(result.length).toBe(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 0, y: 2 },
  ])
})

test("mergeCollinearTraces - do not merge traces on different nets", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
      ],
    },
    {
      mspPairId: "trace2",
      dcConnNetId: "net2",
      globalConnNetId: "net2",
      tracePath: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["trace2"],
      pinIds: ["pin3", "pin4"],
      pins: [
        { pinId: "pin3", x: 1, y: 0, chipId: "chip3" },
        { pinId: "pin4", x: 2, y: 0, chipId: "chip4" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should not merge - different nets
  expect(result.length).toBe(2)
})

test("mergeCollinearTraces - do not merge non-collinear traces", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
      ],
    },
    {
      mspPairId: "trace2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0.5 }, // Different y coordinate
        { x: 2, y: 0.5 },
      ],
      mspConnectionPairIds: ["trace2"],
      pinIds: ["pin3", "pin4"],
      pins: [
        { pinId: "pin3", x: 0, y: 0.5, chipId: "chip3" },
        { pinId: "pin4", x: 2, y: 0.5, chipId: "chip4" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should not merge - different y coordinates
  expect(result.length).toBe(2)
})

test("mergeCollinearTraces - merge three consecutive horizontal traces", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
      ],
    },
    {
      mspPairId: "trace2",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["trace2"],
      pinIds: ["pin2", "pin3"],
      pins: [
        { pinId: "pin2", x: 1, y: 0, chipId: "chip2" },
        { pinId: "pin3", x: 2, y: 0, chipId: "chip3" },
      ],
    },
    {
      mspPairId: "trace3",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      mspConnectionPairIds: ["trace3"],
      pinIds: ["pin3", "pin4"],
      pins: [
        { pinId: "pin3", x: 2, y: 0, chipId: "chip3" },
        { pinId: "pin4", x: 3, y: 0, chipId: "chip4" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should merge all three into one trace
  expect(result.length).toBe(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
  expect(result[0]!.mspConnectionPairIds).toEqual([
    "trace1",
    "trace2",
    "trace3",
  ])
})

test("mergeCollinearTraces - simplify trace with multiple collinear points", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      dcConnNetId: "net1",
      globalConnNetId: "net1",
      tracePath: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ],
      mspConnectionPairIds: ["trace1"],
      pinIds: ["pin1", "pin2"],
      pins: [
        { pinId: "pin1", x: 0, y: 0, chipId: "chip1" },
        { pinId: "pin2", x: 3, y: 0, chipId: "chip2" },
      ],
    },
  ]

  const result = mergeCollinearTraces(traces)

  // Should simplify to just two points
  expect(result.length).toBe(1)
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 3, y: 0 },
  ])
})
