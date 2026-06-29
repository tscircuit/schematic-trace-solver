import { expect, test } from "bun:test"
import { alignNearbySameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignNearbySameNetTraceSegments"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { Point } from "@tscircuit/math-utils"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

test("aligns close horizontal same-net interior segments", () => {
  const output = alignNearbySameNetTraceSegments({
    traces: [
      createTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      createTrace("b", "net1", [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1.1 },
        { x: 3.5, y: 1.1 },
        { x: 3.5, y: 0 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  expect(output[1]!.tracePath[1]!.y).toBe(1)
  expect(output[1]!.tracePath[2]!.y).toBe(1)
})

test("aligns close vertical same-net interior segments", () => {
  const output = alignNearbySameNetTraceSegments({
    traces: [
      createTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 4 },
        { x: 0, y: 4 },
      ]),
      createTrace("b", "net1", [
        { x: 0, y: 0.5 },
        { x: 2.1, y: 0.5 },
        { x: 2.1, y: 3.5 },
        { x: 0, y: 3.5 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  expect(output[1]!.tracePath[1]!.x).toBe(2)
  expect(output[1]!.tracePath[2]!.x).toBe(2)
})

test("does not align close traces from different nets", () => {
  const output = alignNearbySameNetTraceSegments({
    traces: [
      createTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      createTrace("b", "net2", [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1.1 },
        { x: 3.5, y: 1.1 },
        { x: 3.5, y: 0 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  expect(output[1]!.tracePath[1]!.y).toBe(1.1)
  expect(output[1]!.tracePath[2]!.y).toBe(1.1)
})

test("does not align through another net trace", () => {
  const output = alignNearbySameNetTraceSegments({
    traces: [
      createTrace("a", "net1", [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      createTrace("b", "net1", [
        { x: 0.5, y: 0 },
        { x: 0.5, y: 1.1 },
        { x: 3.5, y: 1.1 },
        { x: 3.5, y: 0 },
      ]),
      createTrace("c", "net2", [
        { x: 1, y: 0.8 },
        { x: 1, y: 0.95 },
        { x: 1, y: 1.05 },
        { x: 1, y: 1.2 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  expect(output[1]!.tracePath[1]!.y).toBe(1.1)
  expect(output[1]!.tracePath[2]!.y).toBe(1.1)
})

test("does not move endpoint stubs", () => {
  const output = alignNearbySameNetTraceSegments({
    traces: [
      createTrace("a", "net1", [
        { x: 0, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 0 },
      ]),
      createTrace("b", "net1", [
        { x: 0, y: 1.1 },
        { x: 4, y: 1.1 },
        { x: 4, y: 0 },
      ]),
    ],
    inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  })

  expect(output[1]!.tracePath[0]!.y).toBe(1.1)
  expect(output[1]!.tracePath[1]!.y).toBe(1.1)
})

function createTrace(
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
): SolvedTracePath {
  const pins = [
    { pinId: `${mspPairId}.1`, chipId: "chip1", ...tracePath[0]! },
    {
      pinId: `${mspPairId}.2`,
      chipId: "chip2",
      ...tracePath[tracePath.length - 1]!,
    },
  ] as SolvedTracePath["pins"]

  return {
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: pins.map((pin) => pin.pinId),
  }
}
