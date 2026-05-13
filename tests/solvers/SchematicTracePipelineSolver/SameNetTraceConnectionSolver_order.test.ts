import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

test("same-net trace connection runs after overlap shifting and before first net-label placement", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const pipelineStepNames = solver.pipelineDef.map((step) => step.solverName)
  const overlapShiftIndex = pipelineStepNames.indexOf("traceOverlapShiftSolver")
  const sameNetConnectionIndex = pipelineStepNames.indexOf(
    "sameNetTraceConnectionSolver",
  )
  const firstNetLabelPlacementIndex = pipelineStepNames.indexOf(
    "netLabelPlacementSolver",
  )
  const traceCleanupIndex = pipelineStepNames.indexOf("traceCleanupSolver")
  const postCleanupSameNetConnectionIndex = pipelineStepNames.indexOf(
    "postCleanupSameNetTraceConnectionSolver",
  )
  const secondNetLabelPlacementIndex = pipelineStepNames.lastIndexOf(
    "netLabelPlacementSolver",
  )

  expect(overlapShiftIndex).toBeGreaterThanOrEqual(0)
  expect(sameNetConnectionIndex).toBeGreaterThan(overlapShiftIndex)
  expect(sameNetConnectionIndex).toBeLessThan(firstNetLabelPlacementIndex)
  expect(postCleanupSameNetConnectionIndex).toBeGreaterThan(traceCleanupIndex)
  expect(postCleanupSameNetConnectionIndex).toBeLessThan(
    secondNetLabelPlacementIndex,
  )
})

test("trace-label overlap avoidance receives same-net-normalized traces", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const originalTrace = {
    mspPairId: "a",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "a.1", chipId: "U1", x: 0, y: 0 },
      { pinId: "a.2", chipId: "U2", x: 1, y: 0 },
    ],
    pinIds: ["a.1", "a.2"],
    mspConnectionPairIds: ["a"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  } as SolvedTracePath

  const normalizedTrace = {
    ...originalTrace,
    tracePath: [
      { x: 0, y: 0.05 },
      { x: 1, y: 0.05 },
    ],
  } as SolvedTracePath

  solver.traceOverlapShiftSolver = {
    correctedTraceMap: { a: originalTrace },
  } as any
  solver.sameNetTraceConnectionSolver = {
    getOutput: () => ({ traceMap: { a: normalizedTrace } }),
  } as any
  solver.netLabelPlacementSolver = {
    netLabelPlacements: [],
  } as any

  const traceLabelOverlapStep = solver.pipelineDef.find(
    (step) => step.solverName === "traceLabelOverlapAvoidanceSolver",
  )!
  const [params] = traceLabelOverlapStep.getConstructorParams(
    solver,
  ) as unknown as [{ traces: SolvedTracePath[] }]

  expect(params.traces).toEqual([normalizedTrace])
})

test("first net-label placement receives same-net-normalized traces", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const originalTrace = {
    mspPairId: "a",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "a.1", chipId: "U1", x: 0, y: 0 },
      { pinId: "a.2", chipId: "U2", x: 1, y: 0 },
    ],
    pinIds: ["a.1", "a.2"],
    mspConnectionPairIds: ["a"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  } as SolvedTracePath

  const normalizedTrace = {
    ...originalTrace,
    tracePath: [
      { x: 0, y: 0.05 },
      { x: 1, y: 0.05 },
    ],
  } as SolvedTracePath

  solver.traceOverlapShiftSolver = {
    correctedTraceMap: { a: originalTrace },
  } as any
  solver.sameNetTraceConnectionSolver = {
    getOutput: () => ({ traceMap: { a: normalizedTrace } }),
  } as any

  const firstNetLabelStep = solver.pipelineDef.find(
    (step) => step.solverName === "netLabelPlacementSolver",
  )!
  const [params] = firstNetLabelStep.getConstructorParams(
    solver,
  ) as unknown as [{ inputTraceMap: Record<string, SolvedTracePath> }]

  expect(params.inputTraceMap).toEqual({ a: normalizedTrace })
})

test("final net-label placement receives post-cleanup same-net-normalized traces", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const cleanupTrace = {
    mspPairId: "a",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "a.1", chipId: "U1", x: 0, y: 0 },
      { pinId: "a.2", chipId: "U2", x: 1, y: 0 },
    ],
    pinIds: ["a.1", "a.2"],
    mspConnectionPairIds: ["a"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  } as SolvedTracePath

  const postCleanupNormalizedTrace = {
    ...cleanupTrace,
    tracePath: [
      { x: 0, y: 0.05 },
      { x: 1, y: 0.05 },
    ],
  } as SolvedTracePath

  solver.traceLabelOverlapAvoidanceSolver = {
    getOutput: () => ({ traces: [cleanupTrace] }),
  } as any
  solver.traceCleanupSolver = {
    getOutput: () => ({ traces: [cleanupTrace] }),
  } as any
  solver.postCleanupSameNetTraceConnectionSolver = {
    getOutput: () => ({
      traceMap: { a: postCleanupNormalizedTrace },
      traces: [postCleanupNormalizedTrace],
    }),
  } as any

  const netLabelSteps = solver.pipelineDef.filter(
    (step) => step.solverName === "netLabelPlacementSolver",
  )
  const [params] = netLabelSteps[1]!.getConstructorParams(
    solver,
  ) as unknown as [{ inputTraceMap: Record<string, SolvedTracePath> }]

  expect(params.inputTraceMap).toEqual({ a: postCleanupNormalizedTrace })
})

test("example28 receives post-cleanup same-net-normalized traces", () => {
  const solver = new SchematicTracePipelineSolver({
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const cleanupTrace = {
    mspPairId: "a",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    userNetId: "NET1",
    pins: [
      { pinId: "a.1", chipId: "U1", x: 0, y: 0 },
      { pinId: "a.2", chipId: "U2", x: 1, y: 0 },
    ],
    pinIds: ["a.1", "a.2"],
    mspConnectionPairIds: ["a"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  } as SolvedTracePath

  const postCleanupNormalizedTrace = {
    ...cleanupTrace,
    tracePath: [
      { x: 0, y: 0.05 },
      { x: 1, y: 0.05 },
    ],
  } as SolvedTracePath

  solver.traceLabelOverlapAvoidanceSolver = {
    getOutput: () => ({ traces: [cleanupTrace] }),
  } as any
  solver.traceCleanupSolver = {
    getOutput: () => ({ traces: [cleanupTrace] }),
  } as any
  solver.postCleanupSameNetTraceConnectionSolver = {
    getOutput: () => ({
      traceMap: { a: postCleanupNormalizedTrace },
      traces: [postCleanupNormalizedTrace],
    }),
  } as any
  solver.netLabelPlacementSolver = {
    netLabelPlacements: [],
  } as any

  const example28Step = solver.pipelineDef.find(
    (step) => step.solverName === "example28Solver",
  )!
  const [params] = example28Step.getConstructorParams(solver) as unknown as [
    { traces: SolvedTracePath[] },
  ]

  expect(params.traces).toEqual([postCleanupNormalizedTrace])
})

test("net-label placement groups geometrically touching same-net traces together", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 0.1,
        height: 0.1,
        pins: [
          { pinId: "U1.1", x: 0, y: 0 },
          { pinId: "U1.2", x: 1, y: 0 },
          { pinId: "U1.3", x: 2, y: 0 },
          { pinId: "U1.4", x: 3, y: 0 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      {
        netId: "NET1",
        pinIds: ["U1.1", "U1.2", "U1.3", "U1.4"],
      },
    ],
    availableNetLabelOrientations: { NET1: ["x+"] },
  }
  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const globalConnNetId = netConnMap.getNetConnectedToId("U1.1")!

  const firstTrace = {
    mspPairId: "a",
    dcConnNetId: "NET1",
    globalConnNetId,
    userNetId: "NET1",
    pins: [
      { pinId: "U1.1", chipId: "U1", x: 0, y: 0 },
      { pinId: "U1.2", chipId: "U1", x: 1, y: 0 },
    ],
    pinIds: ["U1.1", "U1.2"],
    mspConnectionPairIds: ["a"],
    tracePath: [
      { x: 0, y: 0 },
      { x: 1.05, y: 0 },
    ],
  } as SolvedTracePath

  const secondTrace = {
    mspPairId: "b",
    dcConnNetId: "NET1",
    globalConnNetId,
    userNetId: "NET1",
    pins: [
      { pinId: "U1.3", chipId: "U1", x: 2, y: 0 },
      { pinId: "U1.4", chipId: "U1", x: 3, y: 0 },
    ],
    pinIds: ["U1.3", "U1.4"],
    mspConnectionPairIds: ["b"],
    tracePath: [
      { x: 1.05, y: 0 },
      { x: 3, y: 0 },
    ],
  } as SolvedTracePath

  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap: { a: firstTrace, b: secondTrace },
  })

  expect(solver.overlappingSameNetTraceGroups).toHaveLength(1)
  expect(solver.overlappingSameNetTraceGroups[0]!.mspConnectionPairIds).toEqual(
    ["a", "b"],
  )
})
