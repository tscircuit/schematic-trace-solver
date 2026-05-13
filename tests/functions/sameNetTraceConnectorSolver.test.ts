import { expect, test } from "bun:test"
import { SameNetTraceConnectorSolver } from "lib/solvers/SameNetTraceConnectorSolver/SameNetTraceConnectorSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  userNetId: globalConnNetId,
  pins: [
    {
      pinId: `${mspPairId}-a`,
      chipId: "chip-a",
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
    },
    {
      pinId: `${mspPairId}-b`,
      chipId: "chip-b",
      x: tracePath[tracePath.length - 1]!.x,
      y: tracePath[tracePath.length - 1]!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}-a`, `${mspPairId}-b`],
})

test("adds connector traces between close endpoints on the same net", () => {
  const solver = new SameNetTraceConnectorSolver({
    maxConnectDistance: 0.25,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net-1", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().addedConnectorTraces).toHaveLength(1)
  expect(solver.getOutput().traces).toHaveLength(3)
  expect(solver.getOutput().addedConnectorTraces[0]!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1.1, y: 0 },
  ])
})

test("does not connect endpoints on different nets", () => {
  const solver = new SameNetTraceConnectorSolver({
    maxConnectDistance: 0.25,
    traces: [
      makeTrace("a", "net-1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "net-2", [
        { x: 1.1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
  })

  solver.solve()

  expect(solver.getOutput().addedConnectorTraces).toHaveLength(0)
  expect(solver.getOutput().traces).toHaveLength(2)
})
