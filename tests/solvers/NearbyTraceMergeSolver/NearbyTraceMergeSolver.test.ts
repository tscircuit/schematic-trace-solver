import { test, expect } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { NearbyTraceMergeSolver } from "lib/solvers/NearbyTraceMergeSolver/NearbyTraceMergeSolver"

const pin = (pinId: string, x: number, y: number) => ({
  pinId,
  x,
  y,
  chipId: pinId.split(".")[0]!,
})

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  points: Array<{ x: number; y: number }>,
): SolvedTracePath => {
  const a = pin(`${mspPairId}.a`, points[0]!.x, points[0]!.y)
  const b = pin(
    `${mspPairId}.b`,
    points[points.length - 1]!.x,
    points[points.length - 1]!.y,
  )

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: globalConnNetId,
    pins: [a, b],
    tracePath: points,
    mspConnectionPairIds: [mspPairId],
    pinIds: [a.pinId, b.pinId],
  }
}

test("merges nearby trace endpoints on the same net", () => {
  const solver = new NearbyTraceMergeSolver({
    traces: [
      trace("a", "GND", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "GND", [
        { x: 1.08, y: 0 },
        { x: 2, y: 0 },
      ]),
      trace("c", "VCC", [
        { x: 1.05, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    maxMergeDistance: 0.1,
  })

  solver.solve()

  const output = solver.getOutput().traces
  expect(output).toHaveLength(2)

  const merged = output.find((t) => t.globalConnNetId === "GND")!
  expect(merged.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ])
  expect(merged.mspConnectionPairIds).toEqual(["a", "b"])
  expect(merged.pinIds).toEqual(["a.a", "a.b", "b.a", "b.b"])
})

test("leaves same-net traces separate when the gap is too large", () => {
  const solver = new NearbyTraceMergeSolver({
    traces: [
      trace("a", "GND", [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
      trace("b", "GND", [
        { x: 1.2, y: 0 },
        { x: 2, y: 0 },
      ]),
    ],
    maxMergeDistance: 0.1,
  })

  solver.solve()

  expect(solver.getOutput().traces).toHaveLength(2)
})
