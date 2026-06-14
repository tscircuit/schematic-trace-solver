import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignSameNetTraceSegments"
import type { InputProblem } from "lib/types/InputProblem"

const emptyInputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const createTrace = ({
  mspPairId,
  globalConnNetId,
  tracePath,
}: Pick<SolvedTracePath, "mspPairId" | "globalConnNetId" | "tracePath">) =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [],
    pins: [],
  }) as unknown as SolvedTracePath

test("alignSameNetTraceSegments aligns close horizontal segments on the same net", () => {
  const traces = [
    createTrace({
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    createTrace({
      mspPairId: "trace-b",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0.5, y: 1 },
        { x: 0.5, y: 0.04 },
        { x: 1.5, y: 0.04 },
        { x: 1.5, y: 1 },
      ],
    }),
  ]

  const aligned = alignSameNetTraceSegments({
    traces,
    inputProblem: emptyInputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0,
  })

  expect(aligned[1]!.tracePath).toEqual([
    { x: 0.5, y: 1 },
    { x: 0.5, y: 0 },
    { x: 1.5, y: 0 },
    { x: 1.5, y: 1 },
  ])
})

test("alignSameNetTraceSegments aligns close vertical segments on the same net", () => {
  const traces = [
    createTrace({
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ],
    }),
    createTrace({
      mspPairId: "trace-b",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 1, y: 0.5 },
        { x: 0.04, y: 0.5 },
        { x: 0.04, y: 1.5 },
        { x: 1, y: 1.5 },
      ],
    }),
  ]

  const aligned = alignSameNetTraceSegments({
    traces,
    inputProblem: emptyInputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0,
  })

  expect(aligned[1]!.tracePath).toEqual([
    { x: 1, y: 0.5 },
    { x: 0, y: 0.5 },
    { x: 0, y: 1.5 },
    { x: 1, y: 1.5 },
  ])
})

test("alignSameNetTraceSegments does not align different nets", () => {
  const traces = [
    createTrace({
      mspPairId: "trace-a",
      globalConnNetId: "net-a",
      tracePath: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    }),
    createTrace({
      mspPairId: "trace-b",
      globalConnNetId: "net-b",
      tracePath: [
        { x: 0.5, y: 1 },
        { x: 0.5, y: 0.04 },
        { x: 1.5, y: 0.04 },
        { x: 1.5, y: 1 },
      ],
    }),
  ]

  const aligned = alignSameNetTraceSegments({
    traces,
    inputProblem: emptyInputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0,
  })

  expect(aligned[1]!.tracePath).toEqual(traces[1]!.tracePath)
})
