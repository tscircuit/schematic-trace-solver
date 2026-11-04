import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetSegments"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { verticalProblem } from "./fixtures/alignSameNetRails"

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
): SolvedTracePath => ({
  mspPairId,
  dcConnNetId: globalConnNetId,
  globalConnNetId,
  userNetId: globalConnNetId,
  pins: [
    {
      pinId: `${mspPairId}.1`,
      chipId: "U1",
      x: tracePath[0]!.x,
      y: tracePath[0]!.y,
    },
    {
      pinId: `${mspPairId}.2`,
      chipId: "U2",
      x: tracePath[tracePath.length - 1]!.x,
      y: tracePath[tracePath.length - 1]!.y,
    },
  ],
  tracePath,
  mspConnectionPairIds: [mspPairId],
  pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
})

test("aligns close overlapping horizontal segments on the same net onto shared Y", () => {
  const traces = [
    makeTrace("t1", "V3_3", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "V3_3", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const result = alignNearbySameNetSegments({ traces })

  expect(result.alignedGroupCount).toBe(1)
  expect(result.traces[0]!.tracePath).toEqual(traces[0]!.tracePath)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 1, y: 0.2 },
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 0.2 },
  ])
})

test("aligns close overlapping vertical segments on the same net onto shared X", () => {
  const traces = [
    makeTrace("t1", "GND", [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
    ]),
    makeTrace("t2", "GND", [
      { x: 0.2, y: 1 },
      { x: 1.08, y: 1 },
      { x: 1.08, y: 3 },
      { x: 0.2, y: 3 },
    ]),
  ]

  const result = alignNearbySameNetSegments({ traces })

  expect(result.alignedGroupCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: 0.2, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 3 },
    { x: 0.2, y: 3 },
  ])
})

test("does not align close segments belonging to different nets", () => {
  const traces = [
    makeTrace("t1", "V3_3", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "GND", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
  ]

  const result = alignNearbySameNetSegments({ traces })

  expect(result.alignedGroupCount).toBe(0)
  expect(result.traces).toEqual(traces)
})

test("preserves terminal endpoint segments and rejects different-net collisions", () => {
  const traces = [
    makeTrace("t1", "V3_3", [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
    ]),
    makeTrace("t2", "V3_3", [
      { x: 1, y: 0.2 },
      { x: 1, y: 1.08 },
      { x: 3, y: 1.08 },
      { x: 3, y: 0.2 },
    ]),
    makeTrace("blocker", "OTHER_NET", [
      { x: 1.5, y: 1 },
      { x: 2.5, y: 1 },
    ]),
  ]

  const result = alignNearbySameNetSegments({ traces })

  expect(result.traces[1]!.tracePath).toEqual(traces[1]!.tracePath)
})

test("integrates with TraceCleanupSolver pipeline", () => {
  const traces = [
    makeTrace("t1", "V3_3", [
      { x: -4, y: 3 },
      { x: -4, y: 4 },
      { x: -1, y: 4 },
      { x: -1, y: 3 },
    ]),
    makeTrace("t2", "V3_3", [
      { x: -3.5, y: 3 },
      { x: -3.5, y: 4.08 },
      { x: -1.5, y: 4.08 },
      { x: -1.5, y: 3 },
    ]),
  ]

  const solver = new TraceCleanupSolver({
    inputProblem: verticalProblem,
    allTraces: traces,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: ["aligning_nearby_same_net_segments"],
  })
  solver.solve()

  const output = solver.getOutput().traces
  expect(output[1]!.tracePath).toEqual([
    { x: -3.5, y: 3 },
    { x: -3.5, y: 4 },
    { x: -1.5, y: 4 },
    { x: -1.5, y: 3 },
  ])
})
