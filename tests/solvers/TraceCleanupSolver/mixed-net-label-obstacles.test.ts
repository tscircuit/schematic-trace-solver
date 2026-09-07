import { expect, test } from "bun:test"
import { getOtherNetLabelObstacles } from "lib/solvers/TraceCleanupSolver/getOtherNetLabelObstacles"
import { minimizeTurnsWithFilteredLabels } from "lib/solvers/TraceCleanupSolver/minimizeTurnsWithFilteredLabels"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
const label = (net: string, x: number, y: number): NetLabelPlacement => ({
  globalConnNetId: net,
  netId: net,
  mspConnectionPairIds: [],
  pinIds: [],
  orientation: "x+",
  anchorPoint: { x, y },
  center: { x, y },
  width: 0.4,
  height: 0.4,
})
const own = label("POWER", 0, 1)
const signal = label("SIGNAL", 0, 0)
const merged = { ...label("group", 0, 0.5), height: 1.4 }
const map = { group: new Set(["POWER", "SIGNAL"]) }

test("only our own label is removed from a mixed-net obstacle group", () => {
  const unrelated = label("OTHER", 5, 5)
  const remoteSignal = label("SIGNAL", 10, 10)
  expect(
    getOtherNetLabelObstacles({
      globalConnNetId: "POWER",
      allLabelPlacements: [merged, unrelated],
      mergedLabelNetIdMap: map,
      unmergedLabelPlacements: [own, signal, remoteSignal, unrelated],
    }),
  ).toEqual([signal, unrelated])
  expect(
    getOtherNetLabelObstacles({
      globalConnNetId: "UNRELATED",
      allLabelPlacements: [merged],
      mergedLabelNetIdMap: map,
      unmergedLabelPlacements: [own, signal],
    }),
  ).toEqual([merged])
  expect(
    getOtherNetLabelObstacles({
      globalConnNetId: "POWER",
      allLabelPlacements: [merged],
      mergedLabelNetIdMap: map,
    }),
  ).toEqual([merged])
})

test("turn minimization cannot straighten a power wire through the signal in its merged group", () => {
  const trace: SolvedTracePath = {
    mspPairId: "power-wire",
    mspConnectionPairIds: [],
    globalConnNetId: "POWER",
    dcConnNetId: "POWER",
    pinIds: [],
    pins: [
      { pinId: "a", chipId: "U1", x: -1, y: 0 },
      { pinId: "b", chipId: "U2", x: 1, y: 0 },
    ],
    tracePath: [
      { x: -1, y: 0 },
      { x: -1, y: -0.5 },
      { x: 1, y: -0.5 },
      { x: 1, y: 0 },
    ],
  }
  const result = minimizeTurnsWithFilteredLabels({
    targetMspConnectionPairId: trace.mspPairId,
    traces: [trace],
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    allLabelPlacements: [merged],
    unmergedLabelPlacements: [own, signal],
    mergedLabelNetIdMap: map,
    paddingBuffer: 0.1,
  })
  expect(result.tracePath[0]).toEqual(trace.tracePath[0])
  expect(result.tracePath.at(-1)).toEqual(trace.tracePath.at(-1))
  expect(
    result.tracePath.slice(1).some((end, index) =>
      segmentIntersectsRect(result.tracePath[index]!, end, {
        minX: -0.2,
        maxX: 0.2,
        minY: -0.2,
        maxY: 0.2,
      }),
    ),
  ).toBe(false)
})
