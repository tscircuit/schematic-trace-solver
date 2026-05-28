import { expect, test } from "bun:test"
import { SameNetTraceJoinSolver } from "lib/solvers/SameNetTraceJoinSolver/SameNetTraceJoinSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  net: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: net,
  globalConnNetId: net,
  pins: [
    { chipId: "U1", pinId: `${id}-a`, x: points[0]!.x, y: points[0]!.y },
    {
      chipId: "U2",
      pinId: `${id}-b`,
      x: points[points.length - 1]!.x,
      y: points[points.length - 1]!.y,
    },
  ],
  mspConnectionPairIds: [id],
  pinIds: [`${id}-a`, `${id}-b`],
  tracePath: points,
})

test("joins close same-net endpoints", () => {
  const solver = new SameNetTraceJoinSolver({
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    maxJoinDistance: 0.25,
  })

  solver.solve()

  expect(solver.traces).toHaveLength(1)
  const joined = solver.traces[0]!.tracePath
  expect(joined).toHaveLength(4)
  expect(
    JSON.stringify(joined) ===
      JSON.stringify([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ]) ||
      JSON.stringify(joined) ===
        JSON.stringify([
          { x: 1, y: 0 },
          { x: 0, y: 0 },
          { x: 1.2, y: 0 },
          { x: 2, y: 0 },
        ]),
  ).toBeTrue()
})

test("does not join traces from different nets", () => {
  const solver = new SameNetTraceJoinSolver({
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "N2", [
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    maxJoinDistance: 0.25,
  })

  solver.solve()

  expect(solver.traces).toHaveLength(2)
})

test("does not join non-axis-aligned endpoint gap", () => {
  const solver = new SameNetTraceJoinSolver({
    traces: [
      makeTrace("a", "N1", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      makeTrace("b", "N1", [
        { x: 1.1, y: 0.1 },
        { x: 2, y: 0.1 },
      ]),
    ],
    maxJoinDistance: 0.25,
  })

  solver.solve()

  expect(solver.traces).toHaveLength(2)
})
