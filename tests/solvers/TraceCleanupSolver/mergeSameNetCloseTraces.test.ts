import { expect, test } from "bun:test"
import { mergeSameNetCloseTraces } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraces"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const makeTrace = (
  id: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath => ({
  mspPairId: id,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  pins: [
    {
      pinId: `${id}-a`,
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
      chipId: "chip-a",
    },
    {
      pinId: `${id}-b`,
      x: tracePath.at(-1)!.x,
      y: tracePath.at(-1)!.y,
      chipId: "chip-b",
    },
  ],
  tracePath,
  mspConnectionPairIds: [id],
  pinIds: [`${id}-a`, `${id}-b`],
})

test("mergeSameNetCloseTraces combines close traces on the same net", () => {
  const traces = [
    makeTrace("a", "GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("b", "GND", [
      { x: 1.05, y: 0.04 },
      { x: 2, y: 0.04 },
    ]),
  ]

  const result = mergeSameNetCloseTraces(traces, 0.1)

  expect(result).toHaveLength(1)
  expect(result[0]!.mspConnectionPairIds).toEqual(["a", "b"])
  expect(result[0]!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 1, y: 0.02 },
    { x: 2, y: 0.04 },
  ])
})

test("mergeSameNetCloseTraces leaves different nets separate", () => {
  const traces = [
    makeTrace("a", "GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("b", "VCC", [
      { x: 1.05, y: 0.04 },
      { x: 2, y: 0.04 },
    ]),
  ]

  expect(mergeSameNetCloseTraces(traces, 0.1)).toHaveLength(2)
})

test("mergeSameNetCloseTraces leaves far same-net traces separate", () => {
  const traces = [
    makeTrace("a", "GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]),
    makeTrace("b", "GND", [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]),
  ]

  expect(mergeSameNetCloseTraces(traces, 0.1)).toHaveLength(2)
})
