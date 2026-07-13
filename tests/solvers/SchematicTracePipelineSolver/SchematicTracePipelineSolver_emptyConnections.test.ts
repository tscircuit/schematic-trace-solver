import { expect, test } from "bun:test"
import { ConnectivityMap } from "connectivity-map"
import inputData from "../../assets/example01.json"
import type { InputProblem } from "lib/types/InputProblem"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { SchematicTraceLinesSolver } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { LongDistancePairSolver } from "lib/solvers/LongDistancePairSolver/LongDistancePairSolver"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { TraceLabelOverlapAvoidanceSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/TraceLabelOverlapAvoidanceSolver"
import { TraceCleanupSolver } from "lib/solvers/TraceCleanupSolver/TraceCleanupSolver"
import { Example28Solver } from "lib/solvers/Example28Solver/Example28Solver"
import { AvailableNetOrientationSolver } from "lib/solvers/AvailableNetOrientationSolver/AvailableNetOrientationSolver"
import { RailNetLabelCornerPlacementSolver } from "lib/solvers/RailNetLabelCornerPlacementSolver/RailNetLabelCornerPlacementSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"
import { NetLabelTraceCollisionSolver } from "lib/solvers/NetLabelTraceCollisionSolver/NetLabelTraceCollisionSolver"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"

const emptyConnectionsProblem: InputProblem = {
  ...(inputData as unknown as InputProblem),
  directConnections: [],
  netConnections: [],
}

test("SchematicTracePipelineSolver solves with empty connections", () => {
  const solver = new SchematicTracePipelineSolver(emptyConnectionsProblem)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.mspConnectionPairSolver!.mspConnectionPairs).toHaveLength(0)
  expect(solver.schematicTraceLinesSolver!.solvedTracePaths).toHaveLength(0)
  expect(solver.traceCleanupSolver!.getOutput().traces).toHaveLength(0)
  expect(solver.netLabelPlacementSolver!.netLabelPlacements).toHaveLength(0)
  expect(
    solver.netLabelNetLabelCollisionSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(0)
})

test("SchematicTracePipelineSolver solves with no chips and empty connections", () => {
  const solver = new SchematicTracePipelineSolver({
    ...emptyConnectionsProblem,
    chips: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("MspConnectionPairSolver solves with empty connections", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: emptyConnectionsProblem,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("SchematicTraceLinesSolver solves with no connection pairs", () => {
  const solver = new SchematicTraceLinesSolver({
    mspConnectionPairs: [],
    chipMap: {},
    dcConnMap: new ConnectivityMap({}),
    globalConnMap: new ConnectivityMap({}),
    inputProblem: emptyConnectionsProblem,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.solvedTracePaths).toHaveLength(0)
})

test("LongDistancePairSolver solves with no connection pairs", () => {
  const solver = new LongDistancePairSolver({
    inputProblem: emptyConnectionsProblem,
    primaryMspConnectionPairs: [],
    alreadySolvedTraces: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().allTracesMerged).toHaveLength(0)
})

test("TraceOverlapShiftSolver solves with no traces", () => {
  const solver = new TraceOverlapShiftSolver({
    inputProblem: emptyConnectionsProblem,
    inputTracePaths: [],
    globalConnMap: new ConnectivityMap({}),
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(Object.keys(solver.correctedTraceMap)).toHaveLength(0)
})

test("NetLabelPlacementSolver solves with empty connections", () => {
  const solver = new NetLabelPlacementSolver({
    inputProblem: emptyConnectionsProblem,
    inputTraceMap: {},
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.netLabelPlacements).toHaveLength(0)
})

test("TraceLabelOverlapAvoidanceSolver solves with no traces or labels", () => {
  const solver = new TraceLabelOverlapAvoidanceSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().traces).toHaveLength(0)
  // Downstream pipeline stages read labelMergingSolver unconditionally
  expect(solver.labelMergingSolver).toBeDefined()
  expect(
    solver.labelMergingSolver!.getOutput().netLabelPlacements,
  ).toHaveLength(0)
})

test("TraceCleanupSolver solves with no traces", () => {
  const solver = new TraceCleanupSolver({
    inputProblem: emptyConnectionsProblem,
    allTraces: [],
    allLabelPlacements: [],
    mergedLabelNetIdMap: {},
    paddingBuffer: 0.1,
  } as any)
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().traces).toHaveLength(0)
})

test("Example28Solver solves with no traces or labels", () => {
  const solver = new Example28Solver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.outputTraces).toHaveLength(0)
  expect(solver.outputNetLabelPlacements).toHaveLength(0)
})

test("AvailableNetOrientationSolver solves with no traces or labels", () => {
  const solver = new AvailableNetOrientationSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().traces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})

test("RailNetLabelCornerPlacementSolver solves with no traces or labels", () => {
  const solver = new RailNetLabelCornerPlacementSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.outputNetLabelPlacements).toHaveLength(0)
})

test("TraceAnchoredNetLabelOverlapSolver solves with no traces or labels", () => {
  const solver = new TraceAnchoredNetLabelOverlapSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})

test("NetLabelTraceCollisionSolver solves with no traces or labels", () => {
  const solver = new NetLabelTraceCollisionSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().traces).toHaveLength(0)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})

test("NetLabelNetLabelCollisionSolver solves with no traces or labels", () => {
  const solver = new NetLabelNetLabelCollisionSolver({
    inputProblem: emptyConnectionsProblem,
    traces: [],
    netLabelPlacements: [],
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  expect(solver.getOutput().netLabelPlacements).toHaveLength(0)
})
