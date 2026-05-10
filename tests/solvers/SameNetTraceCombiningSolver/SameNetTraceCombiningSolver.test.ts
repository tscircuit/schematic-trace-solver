import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SameNetTraceCombiningSolver } from "lib/solvers/SameNetTraceCombiningSolver/SameNetTraceCombiningSolver"

test("snaps close same-net internal segments onto a shared run", () => {
  const traces = [
    {
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 2 },
      ],
      mspConnectionPairIds: ["trace-a"],
      pinIds: ["pin-a1", "pin-a2"],
    },
    {
      mspPairId: "trace-b",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 1, y: -1 },
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
        { x: 3, y: 1 },
      ],
      mspConnectionPairIds: ["trace-b"],
      pinIds: ["pin-b1", "pin-b2"],
    },
  ] as SolvedTracePath[]

  const solver = new SameNetTraceCombiningSolver({ traces })
  solver.solve()

  expect(
    solver.getOutput().traces.find((t) => t.mspPairId === "trace-b"),
  ).toMatchInlineSnapshot(`
      {
        "globalConnNetId": "net-a",
        "mspConnectionPairIds": [
          "trace-b",
        ],
        "mspPairId": "trace-b",
        "pinIds": [
          "pin-b1",
          "pin-b2",
        ],
        "tracePath": [
          {
            "x": 1,
            "y": -1,
          },
          {
            "x": 1,
            "y": 0,
          },
          {
            "x": 3,
            "y": 0,
          },
          {
            "x": 3,
            "y": 1,
          },
        ],
      }
    `)
})

test("leaves close segments on different nets unchanged", () => {
  const traces = [
    {
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      mspConnectionPairIds: ["trace-a"],
      pinIds: ["pin-a1", "pin-a2"],
    },
    {
      mspPairId: "trace-b",
      globalConnNetId: "net-b",
      tracePath: [
        { x: 1, y: -1 },
        { x: 1, y: 0.1 },
        { x: 3, y: 0.1 },
        { x: 3, y: 1 },
      ],
      mspConnectionPairIds: ["trace-b"],
      pinIds: ["pin-b1", "pin-b2"],
    },
  ] as SolvedTracePath[]

  const solver = new SameNetTraceCombiningSolver({ traces })
  solver.solve()

  expect(
    solver.getOutput().traces.find((trace) => trace.mspPairId === "trace-b")
      ?.tracePath,
  ).toEqual(traces[1]!.tracePath)
})

test("rejects snaps that would cross a chip obstacle", () => {
  const traces = [
    {
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      mspConnectionPairIds: ["trace-a"],
      pinIds: ["pin-a1", "pin-a2"],
    },
    {
      mspPairId: "trace-b",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 1.5, y: -1 },
        { x: 1.5, y: 0.1 },
        { x: 4, y: 0.1 },
        { x: 4, y: 1 },
      ],
      mspConnectionPairIds: ["trace-b"],
      pinIds: ["pin-b1", "pin-b2"],
    },
  ] as SolvedTracePath[]

  const solver = new SameNetTraceCombiningSolver({
    traces,
    inputProblem: {
      chips: [
        {
          chipId: "chip-obstacle",
          center: { x: 3, y: 0 },
          width: 0.4,
          height: 0.05,
          pins: [],
        },
      ],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
  })
  solver.solve()

  expect(
    solver.getOutput().traces.find((trace) => trace.mspPairId === "trace-b")
      ?.tracePath,
  ).toEqual(traces[1]!.tracePath)
})
