import { expect, test } from "bun:test"
import { SameNetTraceMergingSolver } from "lib/solvers/SameNetTraceMergingSolver/SameNetTraceMergingSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Array<{ x: number; y: number }>,
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    { pinId: `${mspPairId}.start`, chipId: "chip", ...tracePath[0]! },
    { pinId: `${mspPairId}.end`, chipId: "chip", ...tracePath.at(-1)! },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.start`, `${mspPairId}.end`],
})

test("snaps close parallel same-net segments together", () => {
  const fixedTrace = makeTrace("a", "net0", [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  const traceWithCloseRun = makeTrace("b", "net0", [
    { x: 1, y: -0.5 },
    { x: 1, y: 0.08 },
    { x: 3, y: 0.08 },
    { x: 3, y: -0.5 },
  ])

  const solver = new SameNetTraceMergingSolver({
    allTraces: [fixedTrace, traceWithCloseRun],
    mergeDistance: 0.1,
  })
  solver.solve()

  const [, mergedTrace] = solver.getOutput().traces
  expect(mergedTrace!.tracePath).toEqual([
    { x: 1, y: -0.5 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: -0.5 },
  ])
  expect(solver.stats.mergedSegments).toBe(1)
})

test("leaves close segments on different nets unchanged", () => {
  const solver = new SameNetTraceMergingSolver({
    allTraces: [
      makeTrace("a", "net0", [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ]),
      makeTrace("b", "net1", [
        { x: 1, y: -0.5 },
        { x: 1, y: 0.08 },
        { x: 3, y: 0.08 },
        { x: 3, y: -0.5 },
      ]),
    ],
    mergeDistance: 0.1,
  })
  solver.solve()

  const [, unchangedTrace] = solver.getOutput().traces
  expect(unchangedTrace!.tracePath[1]!.y).toBe(0.08)
  expect(solver.stats.mergedSegments).toBeUndefined()
})
