import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignCloseSameNetSegments } from "lib/solvers/TraceCleanupSolver/alignCloseSameNetSegments"

const trace = (
  id: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId: id,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [id],
    pinIds: [`${id}-a`, `${id}-b`],
    pins: [],
  }) as any

test("aligns close overlapping internal horizontal same-net segments", () => {
  const output = alignCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 0.2 },
      { x: 1, y: 0.2 },
      { x: 1, y: 1.12 },
      { x: 4, y: 1.12 },
      { x: 4, y: 0.2 },
    ]),
  ])

  expect(output[0].tracePath[2].y).toBeCloseTo(1.06)
  expect(output[0].tracePath[3].y).toBeCloseTo(1.06)
  expect(output[1].tracePath[2].y).toBeCloseTo(1.06)
  expect(output[1].tracePath[3].y).toBeCloseTo(1.06)
})

test("aligns close overlapping internal vertical same-net segments", () => {
  const output = alignCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ]),
    trace("b", "net1", [
      { x: 0.2, y: 0 },
      { x: 0.2, y: 1 },
      { x: 1.1, y: 1 },
      { x: 1.1, y: 4 },
      { x: 0.2, y: 4 },
    ]),
  ])

  expect(output[0].tracePath[2].x).toBeCloseTo(1.05)
  expect(output[0].tracePath[3].x).toBeCloseTo(1.05)
  expect(output[1].tracePath[2].x).toBeCloseTo(1.05)
  expect(output[1].tracePath[3].x).toBeCloseTo(1.05)
})

test("does not align different nets or endpoint-only segments", () => {
  const output = alignCloseSameNetSegments([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 0, y: 0.1 },
      { x: 3, y: 0.1 },
    ]),
    trace("c", "net2", [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 1 },
    ]),
    trace("d", "net3", [
      { x: 0, y: 1.1 },
      { x: 1, y: 1.1 },
      { x: 1, y: 2.1 },
      { x: 4, y: 2.1 },
      { x: 4, y: 1.1 },
    ]),
  ])

  expect(output[0].tracePath[0].y).toBe(0)
  expect(output[0].tracePath[1].y).toBe(0)
  expect(output[1].tracePath[0].y).toBe(0.1)
  expect(output[1].tracePath[1].y).toBe(0.1)
  expect(output[2].tracePath[2].y).toBe(2)
  expect(output[2].tracePath[3].y).toBe(2)
  expect(output[3].tracePath[2].y).toBe(2.1)
  expect(output[3].tracePath[3].y).toBe(2.1)
})
