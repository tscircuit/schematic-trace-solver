import { expect, test } from "bun:test"
import { mergeNearbySameNetSegments } from "lib/solvers/TraceCleanupSolver/mergeNearbySameNetSegments"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 2.5, y: 1 },
      width: 1,
      height: 0.4,
      pins: [],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: SolvedTracePath["tracePath"],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
  }) as SolvedTracePath

test("aligns close same-net horizontal interior segments to the longest segment", () => {
  const merged = mergeNearbySameNetSegments([
    trace("main", "VCC", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]),
    trace("branch", "VCC", [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0.04 },
      { x: 4, y: 0.04 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]),
  ])

  expect(merged.find((t) => t.mspPairId === "branch")!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ])
})

test("aligns close same-net vertical interior segments to the longest segment", () => {
  const merged = mergeNearbySameNetSegments([
    trace("main", "VCC", [
      { x: 0, y: 0 },
      { x: 0, y: 5 },
    ]),
    trace("branch", "VCC", [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0.04, y: 1 },
      { x: 0.04, y: 4 },
      { x: 1, y: 4 },
      { x: 1, y: 5 },
    ]),
  ])

  expect(merged.find((t) => t.mspPairId === "branch")!.tracePath).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 4 },
    { x: 1, y: 4 },
    { x: 1, y: 5 },
  ])
})

test("does not align close segments from different nets", () => {
  const merged = mergeNearbySameNetSegments([
    trace("main", "VCC", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]),
    trace("branch", "GND", [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 0.04 },
      { x: 4, y: 0.04 },
      { x: 4, y: 1 },
      { x: 5, y: 1 },
    ]),
  ])

  expect(merged.find((t) => t.mspPairId === "branch")!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0.04 },
    { x: 4, y: 0.04 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ])
})

test("keeps endpoint-only traces pinned", () => {
  const merged = mergeNearbySameNetSegments([
    trace("main", "VCC", [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
    ]),
    trace("branch", "VCC", [
      { x: 0, y: 0.04 },
      { x: 5, y: 0.04 },
    ]),
  ])

  expect(merged.find((t) => t.mspPairId === "branch")!.tracePath).toEqual([
    { x: 0, y: 0.04 },
    { x: 5, y: 0.04 },
  ])
})

test("TraceCleanupSolver runs close same-net segment merging as the final cleanup step", () => {
  const solver = new TraceCleanupSolver({
    inputProblem,
    allTraces: [
      trace("main", "VCC", [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
      ]),
      trace("branch", "VCC", [
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: 0.04 },
        { x: 4, y: 0.04 },
        { x: 4, y: 1 },
        { x: 5, y: 1 },
      ]),
    ],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.01,
  })

  solver.solve()

  expect(solver.getOutput().traces.find((t) => t.mspPairId === "branch")!.tracePath).toEqual([
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ])
})
