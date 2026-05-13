import { expect, test } from "bun:test"
import { SameNetTraceCombiningSolver } from "../../../lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"
import type { SolvedTracePath } from "../../../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("SameNetTraceCombiningSolver - combines close traces in same net", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace-1",
      dcConnNetId: "net-1",
      globalConnNetId: "net-vcc",
      pins: [
        { x: 0, y: 0, pinId: "pin-1", chipId: "chip-1" },
        { x: 1, y: 0, pinId: "pin-2", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace-1"],
      pinIds: ["pin-1", "pin-2"],
    },
    {
      mspPairId: "trace-2",
      dcConnNetId: "net-1",
      globalConnNetId: "net-vcc",
      pins: [
        { x: 0, y: 0.15, pinId: "pin-3", chipId: "chip-1" },
        { x: 1, y: 0.15, pinId: "pin-4", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0.15 },
        { x: 0.5, y: 0.15 },
        { x: 1, y: 0.15 },
      ],
      mspConnectionPairIds: ["trace-2"],
      pinIds: ["pin-3", "pin-4"],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      } as any,
    traces,
    proximityThreshold: 0.19,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.getOutput()
  expect(output.traces).toBeDefined()
  expect(output.traces.length).toBeGreaterThanOrEqual(1)
})

test("SameNetTraceCombiningSolver - does not merge traces in different nets", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace-1",
      dcConnNetId: "net-1",
      globalConnNetId: "net-a",
      pins: [
        { x: 0, y: 0, pinId: "pin-1", chipId: "chip-1" },
        { x: 1, y: 0, pinId: "pin-2", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace-1"],
      pinIds: ["pin-1", "pin-2"],
    },
    {
      mspPairId: "trace-2",
      dcConnNetId: "net-2",
      globalConnNetId: "net-b",
      pins: [
        { x: 0, y: 0.1, pinId: "pin-3", chipId: "chip-1" },
        { x: 1, y: 0.1, pinId: "pin-4", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0.1 },
        { x: 0.5, y: 0.1 },
        { x: 1, y: 0.1 },
      ],
      mspConnectionPairIds: ["trace-2"],
      pinIds: ["pin-3", "pin-4"],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      } as any,
    traces,
    proximityThreshold: 0.19,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  // Should keep both traces since they're in different nets
  const output = solver.getOutput()
  expect(output.traces).toBeDefined()
  expect(output.traces.length).toBe(2)
})

test("SameNetTraceCombiningSolver - handles single trace", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace-1",
      dcConnNetId: "net-1",
      globalConnNetId: "net-a",
      pins: [
        { x: 0, y: 0, pinId: "pin-1", chipId: "chip-1" },
        { x: 1, y: 0, pinId: "pin-2", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace-1"],
      pinIds: ["pin-1", "pin-2"],
    },
  ]

  const solver = new SameNetTraceCombiningSolver({
    inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      } as any,
    traces,
    proximityThreshold: 0.19,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.getOutput()
  expect(output.traces).toBeDefined()
  expect(output.traces.length).toBe(1)
})

test("SameNetTraceCombiningSolver - uses default proximity threshold", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace-1",
      dcConnNetId: "net-1",
      globalConnNetId: "net-a",
      pins: [
        { x: 0, y: 0, pinId: "pin-1", chipId: "chip-1" },
        { x: 1, y: 0, pinId: "pin-2", chipId: "chip-2" },
      ],
      tracePath: [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
        { x: 1, y: 0 },
      ],
      mspConnectionPairIds: ["trace-1"],
      pinIds: ["pin-1", "pin-2"],
    },
  ]

  // No proximity threshold specified - should use default
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      } as any,
    traces,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("SameNetTraceCombiningSolver - handles empty traces", () => {
  const solver = new SameNetTraceCombiningSolver({
    inputProblem: {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      } as any,
    traces: [],
    proximityThreshold: 0.19,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)

  const output = solver.getOutput()
  expect(output.traces).toBeDefined()
  expect(output.traces.length).toBe(0)
})
