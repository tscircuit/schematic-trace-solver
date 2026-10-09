import { expect, test } from "bun:test"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { align, createTrace } from "./fixtures/alignSameNetRails"
import { problem, getTraces, labels } from "./fixtures/partialRailGroup"

test("aligns the clear pair when conflicting label anchors block the full rail group", () => {
  const traces = getTraces()
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: labels,
  })
  expect(result.alignedRailGroupCount).toBe(1)
  expect(result.traces[1]!.tracePath).toEqual([
    { x: -1, y: 1 },
    { x: -2, y: 1 },
    { x: -2, y: -1 },
    { x: -1, y: -1 },
  ])
  expect(result.traces[0]).toEqual(traces[0])
  expect(result.traces[2]).toEqual(traces[2])
  expect(traces).toEqual(getTraces())
})

test("preserves all trace identities, pin endpoints and labels", () => {
  const traces = getTraces()
  const originalLabels = structuredClone(labels)
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: labels,
  })
  for (const [i, trace] of result.traces.entries()) {
    const { tracePath: _, ...metadata } = trace
    const { tracePath: __, ...originalMetadata } = traces[i]!
    expect(metadata).toEqual(originalMetadata)
    expect(trace.tracePath[0]).toEqual(traces[i]!.tracePath[0])
    expect(trace.tracePath.at(-1)).toEqual(traces[i]!.tracePath.at(-1))
  }
  expect(labels).toEqual(originalLabels)
})

test("does not align the clear pair through a component obstacle", () => {
  const traces = getTraces()
  const result = align(traces, {
    inputProblem: {
      ...problem,
      chips: [
        ...problem.chips,
        {
          chipId: "barrier",
          center: { x: -2, y: 0 },
          width: 0.06,
          height: 0.4,
          pins: [],
        },
      ],
    },
    netLabelPlacements: labels,
  })
  expect(result.traces).toEqual(traces)
})

test("does not align the clear pair onto a different-net trace", () => {
  const traces = getTraces()
  traces.push(
    createTrace(
      "other",
      [
        { x: -2, y: -0.5 },
        { x: -2, y: 0.5 },
      ],
      [
        { pinId: "X.1", chipId: "X", x: -2, y: -0.5 },
        { pinId: "Y.1", chipId: "Y", x: -2, y: 0.5 },
      ],
      "other-net",
    ),
  )
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: labels,
  })
  expect(result.traces).toEqual(traces)
})

test("does not align the clear pair through an unrelated net label", () => {
  const traces = getTraces()
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: [
      ...labels,
      {
        globalConnNetId: "other-net",
        netId: "OTHER",
        mspConnectionPairIds: [],
        pinIds: [],
        orientation: "x+",
        anchorPoint: { x: -2.04, y: 0 },
        center: { x: -2, y: 0 },
        width: 0.08,
        height: 0.3,
      },
    ],
  })
  expect(result.traces).toEqual(traces)
})

test("does not align any rail when all three label anchors are fixed", () => {
  const traces = getTraces()
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: [
      ...labels,
      {
        ...labels[0]!,
        mspConnectionPairIds: ["rail-1"],
        pinIds: ["U1.2", "U1.3"],
        anchorPoint: { x: -2.1, y: 0 },
        center: { x: -1.9, y: 0 },
      },
    ],
  })
  expect(result.traces).toEqual(traces)
})

test("does not lengthen a partial group to reach a fixed label", () => {
  const traces = getTraces()
  const outwardLabel = {
    ...labels[1]!,
    orientation: "x-" as const,
    center: { x: -2.4, y: -2 },
  }
  const result = align(traces, {
    inputProblem: problem,
    netLabelPlacements: [labels[0]!, outwardLabel],
  })
  expect(result.traces).toEqual(traces)

  // Whole-group label alignment keeps its existing permitted behavior.
  const wholeGroup = align(traces, {
    inputProblem: problem,
    netLabelPlacements: [outwardLabel],
  })
  expect(wholeGroup.alignedRailGroupCount).toBe(1)
  expect(wholeGroup.traces[1]!.tracePath[1]!.x).toBe(-2.2)
})

test("does not merge different nets or modify ineligible traces", () => {
  const traces = getTraces()
  const splitNets = traces.map((trace) => ({
    ...trace,
    globalConnNetId: trace.mspPairId,
  }))
  expect(align(splitNets, { inputProblem: problem }).traces).toEqual(splitNets)
  expect(
    align(traces, {
      inputProblem: problem,
      netLabelPlacements: labels,
      eligibleTraceIds: new Set(["rail-0", "rail-2"]),
    }).traces,
  ).toEqual(traces)
})

test("is deterministic, stable on a second pass, and independent of input ordering", () => {
  const traces = getTraces()
  const options = { inputProblem: problem, netLabelPlacements: labels }
  const result = align(traces, options)
  expect(align(traces, options)).toEqual(result)
  expect(align(result.traces, options).traces).toEqual(result.traces)
  const reverse = align([...traces].reverse(), options).traces.reverse()
  expect(reverse).toEqual(result.traces)
})

test("retains whole-group priority when all rails can align safely", () => {
  const result = align(getTraces(), { inputProblem: problem })
  expect(result.alignedRailGroupCount).toBe(1)
  for (const trace of result.traces) expect(trace.tracePath[1]!.x).toBe(-2)
})

test("uses the partial alignment in the existing cleanup pipeline operation", () => {
  const solver = new TraceCleanupSolver({
    inputProblem: problem,
    allTraces: getTraces(),
    allLabelPlacements: labels,
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
    operations: ["aligning_same_net_rails"],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.stats.alignedTraceCount).toBe(1)
  expect(solver.getOutput().traces[1]!.tracePath[1]!.x).toBe(-2)
})
