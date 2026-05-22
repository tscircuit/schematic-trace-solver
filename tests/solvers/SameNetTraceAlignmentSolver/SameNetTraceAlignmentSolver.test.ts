import { expect, test } from "bun:test"
import { SameNetTraceAlignmentSolver } from "lib/solvers/SameNetTraceAlignmentSolver/SameNetTraceAlignmentSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = ({
  id,
  netId,
  tracePath,
}: {
  id: string
  netId: string
  tracePath: Array<{ x: number; y: number }>
}): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: netId,
  globalConnNetId: netId,
  pins: [
    { pinId: `${id}.1`, chipId: "U1", x: tracePath[0]!.x, y: tracePath[0]!.y },
    {
      pinId: `${id}.2`,
      chipId: "U1",
      x: tracePath.at(-1)!.x,
      y: tracePath.at(-1)!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [id],
  pinIds: [`${id}.1`, `${id}.2`],
})

test("aligns close overlapping horizontal same-net internal segments", () => {
  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces: [
      makeTrace({
        id: "a",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 3, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0.2 },
          { x: 0, y: 1.1 },
          { x: 3, y: 1.1 },
          { x: 3, y: 0.2 },
        ],
      }),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traceMap
  expect(output.b!.tracePath[1]!.y).toBeCloseTo(1)
  expect(output.b!.tracePath[2]!.y).toBeCloseTo(1)
})

test("aligns close overlapping vertical same-net internal segments", () => {
  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces: [
      makeTrace({
        id: "a",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 3 },
          { x: 0, y: 3 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "GND",
        tracePath: [
          { x: 0.2, y: 0 },
          { x: 1.1, y: 0 },
          { x: 1.1, y: 3 },
          { x: 0.2, y: 3 },
        ],
      }),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traceMap
  expect(output.b!.tracePath[1]!.x).toBeCloseTo(1)
  expect(output.b!.tracePath[2]!.x).toBeCloseTo(1)
})

test("does not align close segments from different nets", () => {
  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces: [
      makeTrace({
        id: "a",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 3, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "VCC",
        tracePath: [
          { x: 0, y: 0.2 },
          { x: 0, y: 1.1 },
          { x: 3, y: 1.1 },
          { x: 3, y: 0.2 },
        ],
      }),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traceMap
  expect(output.b!.tracePath[1]!.y).toBeCloseTo(1.1)
  expect(output.b!.tracePath[2]!.y).toBeCloseTo(1.1)
})

test("preserves terminal-only segments so pin endpoints do not drift", () => {
  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces: [
      makeTrace({
        id: "a",
        netId: "GND",
        tracePath: [
          { x: 0, y: 1 },
          { x: 3, y: 1 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "GND",
        tracePath: [
          { x: 0, y: 1.1 },
          { x: 3, y: 1.1 },
        ],
      }),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traceMap
  expect(output.b!.tracePath[0]!.y).toBeCloseTo(1.1)
  expect(output.b!.tracePath[1]!.y).toBeCloseTo(1.1)
})

test("rejects an alignment that would create a different-net intersection", () => {
  const solver = new SameNetTraceAlignmentSolver({
    inputProblem,
    traces: [
      makeTrace({
        id: "a",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
          { x: 3, y: 1 },
          { x: 3, y: 0 },
        ],
      }),
      makeTrace({
        id: "b",
        netId: "GND",
        tracePath: [
          { x: 0, y: 0.2 },
          { x: 0, y: 1.1 },
          { x: 3, y: 1.1 },
          { x: 3, y: 0.2 },
        ],
      }),
      makeTrace({
        id: "blocker",
        netId: "VCC",
        tracePath: [
          { x: 1.5, y: 0.95 },
          { x: 1.5, y: 1.05 },
        ],
      }),
    ],
  })

  solver.solve()

  const output = solver.getOutput().traceMap
  expect(output.b!.tracePath[1]!.y).toBeCloseTo(1.1)
  expect(output.b!.tracePath[2]!.y).toBeCloseTo(1.1)
})
