import { expect, test } from "bun:test"
import { SameNetSegmentMergingSolver } from "lib/solvers/SameNetSegmentMergingSolver/SameNetSegmentMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const createTrace = (
  id: string,
  netId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: netId,
  globalConnNetId: netId,
  pins: [
    { pinId: `${id}-a`, chipId: "A", x: tracePath[0]!.x, y: tracePath[0]!.y },
    {
      pinId: `${id}-b`,
      chipId: "B",
      x: tracePath[tracePath.length - 1]!.x,
      y: tracePath[tracePath.length - 1]!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [id],
  pinIds: [`${id}-a`, `${id}-b`],
})

test("SameNetSegmentMergingSolver snaps overlapping internal same-net segments together", () => {
  const solver = new SameNetSegmentMergingSolver({
    inputProblem,
    allTraces: [
      createTrace("t1", "net-1", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
      createTrace("t2", "net-1", [
        { x: -3, y: 0.2 },
        { x: -1, y: 0.2 },
        { x: -1, y: 1.12 },
        { x: 1, y: 1.12 },
        { x: 1, y: 0.2 },
        { x: 3, y: 0.2 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  expect(traces[0]!.tracePath[2]!.y).toBeCloseTo(1.04, 5)
  expect(traces[0]!.tracePath[3]!.y).toBeCloseTo(1.04, 5)
  expect(traces[1]!.tracePath[2]!.y).toBeCloseTo(1.04, 5)
  expect(traces[1]!.tracePath[3]!.y).toBeCloseTo(1.04, 5)
})

test("SameNetSegmentMergingSolver preserves anchored endpoint segments and only snaps the movable trace", () => {
  const solver = new SameNetSegmentMergingSolver({
    inputProblem,
    allTraces: [
      createTrace("t1", "net-1", [
        { x: -3, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 0 },
      ]),
      createTrace("t2", "net-1", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1.1 },
        { x: 2, y: 1.1 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
      createTrace("t3", "net-2", [
        { x: -3, y: 0 },
        { x: -2, y: 0 },
        { x: -2, y: 1.08 },
        { x: 2, y: 1.08 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
      ]),
    ],
  })

  solver.solve()

  const traces = solver.getOutput().traces
  expect(traces[0]!.tracePath[0]!.y).toBe(1)
  expect(traces[0]!.tracePath[1]!.y).toBe(1)
  expect(traces[1]!.tracePath[2]!.y).toBeCloseTo(1, 5)
  expect(traces[1]!.tracePath[3]!.y).toBeCloseTo(1, 5)
  expect(traces[2]!.tracePath[2]!.y).toBeCloseTo(1.08, 5)
  expect(traces[2]!.tracePath[3]!.y).toBeCloseTo(1.08, 5)
})
