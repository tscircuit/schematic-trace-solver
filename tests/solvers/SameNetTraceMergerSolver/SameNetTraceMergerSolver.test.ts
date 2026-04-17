import { expect, test, describe } from "bun:test"
import { SameNetTraceMergerSolver } from "lib/solvers/SameNetTraceMergerSolver/SameNetTraceMergerSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const mockInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

describe("SameNetTraceMergerSolver", () => {
  test("merges close horizontal segments from same net", () => {
    // Two traces from the same net with horizontal segments at Y=1.0 and Y=1.05
    // They should be merged to share the same Y coordinate
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p1", x: 0, y: 1.0, chipId: "c1" },
          { pinId: "p2", x: 2, y: 1.0, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.0 },
          { x: 1, y: 1.0 },
          { x: 1, y: 2.0 },
        ],
        mspConnectionPairIds: ["trace1"],
        pinIds: ["p1", "p2"],
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p3", x: 0, y: 1.05, chipId: "c1" },
          { pinId: "p4", x: 2, y: 1.05, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.05 },
          { x: 1, y: 1.05 },
          { x: 1, y: 2.05 },
        ],
        mspConnectionPairIds: ["trace2"],
        pinIds: ["p3", "p4"],
      },
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: mockInputProblem,
      traces,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    const output = solver.getOutput()

    // Both traces should now have their horizontal segment at the same Y
    const trace1Y = output.traces[0]!.tracePath[1]!.y
    const trace2Y = output.traces[1]!.tracePath[1]!.y
    expect(Math.abs(trace1Y - trace2Y)).toBeLessThan(0.01)
  })

  test("does not merge traces from different nets", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p1", x: 0, y: 1.0, chipId: "c1" },
          { pinId: "p2", x: 2, y: 1.0, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.0 },
          { x: 1, y: 1.0 },
          { x: 1, y: 2.0 },
        ],
        mspConnectionPairIds: ["trace1"],
        pinIds: ["p1", "p2"],
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net2",
        globalConnNetId: "net2",
        pins: [
          { pinId: "p3", x: 0, y: 1.05, chipId: "c1" },
          { pinId: "p4", x: 2, y: 1.05, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.05 },
          { x: 1, y: 1.05 },
          { x: 1, y: 2.05 },
        ],
        mspConnectionPairIds: ["trace2"],
        pinIds: ["p3", "p4"],
      },
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: mockInputProblem,
      traces,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    const output = solver.getOutput()

    // Traces from different nets should NOT be merged
    expect(output.traces[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 5)
    expect(output.traces[1]!.tracePath[1]!.y).toBeCloseTo(1.05, 5)
  })

  test("merges close vertical segments from same net", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p1", x: 1.0, y: 0, chipId: "c1" },
          { pinId: "p2", x: 1.0, y: 2, chipId: "c2" },
        ],
        tracePath: [
          { x: 1.0, y: 0 },
          { x: 1.0, y: 1 },
          { x: 2.0, y: 1 },
        ],
        mspConnectionPairIds: ["trace1"],
        pinIds: ["p1", "p2"],
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p3", x: 1.05, y: 0, chipId: "c1" },
          { pinId: "p4", x: 1.05, y: 2, chipId: "c2" },
        ],
        tracePath: [
          { x: 1.05, y: 0 },
          { x: 1.05, y: 1 },
          { x: 2.05, y: 1 },
        ],
        mspConnectionPairIds: ["trace2"],
        pinIds: ["p3", "p4"],
      },
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: mockInputProblem,
      traces,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    const output = solver.getOutput()

    // Both traces should now have their vertical segment at the same X
    const trace1X = output.traces[0]!.tracePath[1]!.x
    const trace2X = output.traces[1]!.tracePath[1]!.x
    expect(Math.abs(trace1X - trace2X)).toBeLessThan(0.01)
  })

  test("does not merge segments that are too far apart", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p1", x: 0, y: 1.0, chipId: "c1" },
          { pinId: "p2", x: 2, y: 1.0, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.0 },
          { x: 1, y: 1.0 },
          { x: 1, y: 2.0 },
        ],
        mspConnectionPairIds: ["trace1"],
        pinIds: ["p1", "p2"],
      },
      {
        mspPairId: "trace2",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p3", x: 0, y: 2.0, chipId: "c1" },
          { pinId: "p4", x: 2, y: 2.0, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 2.0 },
          { x: 1, y: 2.0 },
          { x: 1, y: 3.0 },
        ],
        mspConnectionPairIds: ["trace2"],
        pinIds: ["p3", "p4"],
      },
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: mockInputProblem,
      traces,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    const output = solver.getOutput()

    // Traces too far apart should NOT be merged
    expect(output.traces[0]!.tracePath[1]!.y).toBeCloseTo(1.0, 5)
    expect(output.traces[1]!.tracePath[1]!.y).toBeCloseTo(2.0, 5)
  })

  test("handles single trace without error", () => {
    const traces: SolvedTracePath[] = [
      {
        mspPairId: "trace1",
        dcConnNetId: "net1",
        globalConnNetId: "net1",
        pins: [
          { pinId: "p1", x: 0, y: 1.0, chipId: "c1" },
          { pinId: "p2", x: 2, y: 1.0, chipId: "c2" },
        ],
        tracePath: [
          { x: 0, y: 1.0 },
          { x: 1, y: 1.0 },
          { x: 1, y: 2.0 },
        ],
        mspConnectionPairIds: ["trace1"],
        pinIds: ["p1", "p2"],
      },
    ]

    const solver = new SameNetTraceMergerSolver({
      inputProblem: mockInputProblem,
      traces,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.getOutput().traces).toHaveLength(1)
  })
})
