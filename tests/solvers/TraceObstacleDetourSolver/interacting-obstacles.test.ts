import { expect, test } from "bun:test"
import type { Bounds, Point } from "@tscircuit/math-utils"
import { TraceObstacleDetourSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/TraceObstacleDetourSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"

const trace = (net: string, path: Point[]): SolvedTracePath => ({
  mspPairId: net,
  mspConnectionPairIds: [net],
  dcConnNetId: net,
  globalConnNetId: net,
  pinIds: [`${net}.1`, `${net}.2`],
  pins: [
    { pinId: `${net}.1`, chipId: "A", ...path[0]! },
    { pinId: `${net}.2`, chipId: "B", ...path.at(-1)! },
  ],
  tracePath: path,
})
const rotate = (p: Point, turns: number): Point =>
  turns === 0 ? p : rotate({ x: -p.y, y: p.x }, turns - 1)
const rotateBounds = (b: Bounds, turns: number): Bounds => {
  const a = rotate({ x: b.minX, y: b.minY }, turns),
    c = rotate({ x: b.maxX, y: b.maxY }, turns)
  return {
    minX: Math.min(a.x, c.x),
    maxX: Math.max(a.x, c.x),
    minY: Math.min(a.y, c.y),
    maxY: Math.max(a.y, c.y),
  }
}
for (const turns of [0, 1, 2, 3])
  test(`clears a label and a separate text obstruction (rotation ${turns})`, () => {
    const original = trace(
      "signal",
      [
        { x: 0, y: 3 },
        { x: 5, y: 3 },
        { x: 5, y: -3 },
        { x: 4, y: -3 },
      ].map((p) => rotate(p, turns)),
    )
    const obstacles = [
      { minX: 2, maxX: 3, minY: 2.9, maxY: 3.2 },
      { minX: 4.8, maxX: 5.4, minY: 0, maxY: 1 },
    ].map((b) => rotateBounds(b, turns))
    const saved = structuredClone(original)
    const solver = new TraceObstacleDetourSolver({
      trace: original,
      obstacles,
      otherNetTraces: [],
      sameNetTraces: [],
      clearance: 0.1,
    })
    solver.solve()
    expect(solver.solved).toBe(true)
    const path = solver.solvedTracePath!
    expect(path[0]).toEqual(original.tracePath[0])
    expect(path.at(-1)).toEqual(original.tracePath.at(-1))
    for (const b of obstacles)
      expect(
        path.slice(1).some((p, i) => segmentIntersectsRect(path[i]!, p, b)),
      ).toBe(false)
    for (let i = 1; i < path.length; i++)
      expect(
        Math.abs(path[i]!.x - path[i - 1]!.x) < 1e-6 ||
          Math.abs(path[i]!.y - path[i - 1]!.y) < 1e-6,
      ).toBe(true)
    expect(original).toEqual(saved)
  })

test("does not put a detour on another net's parallel rail", () => {
  const original = trace("signal", [
    { x: 2, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ])
  const other = trace("other", [
    { x: -0.1, y: -1 },
    { x: -0.1, y: 3 },
  ])
  const solver = new TraceObstacleDetourSolver({
    trace: original,
    obstacles: [{ minX: 0, maxX: 1.5, minY: 0.5, maxY: 1.5 }],
    otherNetTraces: [other],
    sameNetTraces: [],
    clearance: 0.1,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(doesPathCoincideWithTraces(solver.solvedTracePath!, [other])).toBe(
    false,
  )
})

test("preserves a same-net branch and an attached pin", () => {
  const original = trace("signal", [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ])
  const branch = {
    ...trace("branch", [
      { x: 3, y: 1 },
      { x: 5, y: 1 },
    ]),
    globalConnNetId: "signal",
  }
  const pin = { x: 4, y: 1.5 }
  const solver = new TraceObstacleDetourSolver({
    trace: original,
    obstacles: [{ minX: 3.8, maxX: 4.2, minY: 2, maxY: 3 }],
    otherNetTraces: [],
    sameNetTraces: [branch],
    pinPositions: [pin],
    clearance: 0.1,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(tracePathContainsPoint(solver.solvedTracePath!, { x: 4, y: 1 })).toBe(
    true,
  )
  expect(tracePathContainsPoint(solver.solvedTracePath!, pin)).toBe(true)
})

test("fits a detour lead-in between a fixed junction and a nearby label", () => {
  const original = trace("signal", [
    { x: 0, y: 0 },
    { x: 0, y: 0.6 },
    { x: 0.1, y: 0.6 },
  ])
  const obstacle = { minX: -0.3, maxX: 0.1, minY: 0.1, maxY: 0.3 }
  const solver = new TraceObstacleDetourSolver({
    trace: original,
    obstacles: [obstacle],
    otherNetTraces: [],
    sameNetTraces: [],
    clearance: 0.1,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  const path = solver.solvedTracePath!
  expect(path[0]).toEqual(original.tracePath[0])
  expect(path.at(-1)).toEqual(original.tracePath.at(-1))
  expect(
    path
      .slice(1)
      .some((point, index) =>
        segmentIntersectsRect(path[index]!, point, obstacle),
      ),
  ).toBe(false)
})
