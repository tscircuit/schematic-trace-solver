import { expect, test } from "bun:test"
import {
  type GraphicsObject,
  getSvgFromGraphicsObject,
  stackGraphicsHorizontally,
} from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { alignSameNetTraceSegments } from "lib/solvers/TraceCleanupSolver/alignSameNetTraceSegments"
import inputData from "../../assets/align-same-net-trace-segments.input.json"

const traces = inputData.allTraces as unknown as SolvedTracePath[]

const visualizeTraces = (
  tracesToVisualize: SolvedTracePath[],
): GraphicsObject => ({
  lines: tracesToVisualize.map((trace) => ({
    points: trace.tracePath,
    strokeColor: "blue",
  })),
})

test("alignSameNetTraceSegments before and after", () => {
  const alignedTraces = alignSameNetTraceSegments({
    traces,
    inputProblem: inputData.inputProblem,
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0,
  })

  expect(alignedTraces[1]!.tracePath).toEqual([
    { x: 0.5, y: 1 },
    { x: 0.5, y: 0 },
    { x: 3.5, y: 0 },
    { x: 3.5, y: 1 },
  ])
  expect(alignedTraces[3]!.tracePath).toEqual([
    { x: 7, y: 0.5 },
    { x: 6, y: 0.5 },
    { x: 6, y: 3.5 },
    { x: 7, y: 3.5 },
  ])

  const comparison = getSvgFromGraphicsObject(
    stackGraphicsHorizontally(
      [visualizeTraces(traces), visualizeTraces(alignedTraces)],
      {
        titles: ["Before: close parallel traces", "After: shared X/Y axes"],
      },
    ),
    { backgroundColor: "white" },
  )

  expect(comparison).toMatchSvgSnapshot(import.meta.path)
})
