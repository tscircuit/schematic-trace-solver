import type { Point } from "@tscircuit/math-utils"
import { expect, test } from "bun:test"
import { countPathIntersections } from "lib/solvers/Example28Solver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceOverlapShiftSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapShiftSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

const makeTrace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
) =>
  ({
    mspPairId,
    globalConnNetId,
    tracePath,
  }) as SolvedTracePath

const createSolver = (inputTracePaths: SolvedTracePath[]) =>
  new TraceOverlapShiftSolver({
    inputProblem,
    inputTracePaths,
    globalConnMap: {} as any,
  })

test("separates a collinear point contact using internal rails", () => {
  const traceA = makeTrace("trace-a", "net-a", [
    { x: 0.65, y: 0.825 },
    { x: 0.45, y: 0.825 },
    { x: 0, y: 0.825 },
    { x: 0, y: -0.825 },
    { x: -0.45, y: -0.825 },
    { x: -0.65, y: -0.825 },
  ])
  const traceB = makeTrace("trace-b", "net-b", [
    { x: 1.4, y: -0.725 },
    { x: 1.6, y: -0.725 },
    { x: 1.6, y: 1.365 },
    { x: 0, y: 1.365 },
    { x: 0, y: 0.825 },
    { x: -0.65, y: 0.825 },
  ])
  const solver = createSolver([traceA, traceB])

  expect(
    solver
      .findNextOverlapIssue()!
      .overlappingTraceSegments.map(
        (group) => group.pathsWithOverlap[0]!.traceSegmentIndex,
      ),
  ).toEqual([2, 3])

  solver.solve()

  const correctedA = solver.correctedTraceMap[traceA.mspPairId]!
  const correctedB = solver.correctedTraceMap[traceB.mspPairId]!
  expect(
    countPathIntersections(correctedA.tracePath, correctedB.tracePath),
  ).toBe(0)
  expect(correctedA.tracePath[2]!.x).toBeCloseTo(0)
  expect(correctedB.tracePath[3]!.x).toBeCloseTo(-0.1)
})

test("preserves deterministic separation for a compound overlap", () => {
  const lowerTrace = makeTrace("lower", "lower-net", [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ])
  const upperTrace = makeTrace("upper", "upper-net", [
    { x: 0, y: 0.2 },
    { x: 1, y: 0.2 },
    { x: 1, y: 1.2 },
    { x: 1, y: 2.2 },
    { x: 2, y: 2.2 },
  ])
  const solver = createSolver([lowerTrace, upperTrace])

  const issue = solver.findNextOverlapIssue()
  expect(issue?.interactionKind).toBe("overlap")
  expect(
    issue?.overlappingTraceSegments.map(
      (group) => group.pathsWithOverlap.length,
    ),
  ).toEqual([2, 2])

  solver.solve()

  const correctedLower = solver.correctedTraceMap[lowerTrace.mspPairId]!
  const correctedUpper = solver.correctedTraceMap[upperTrace.mspPairId]!
  expect(correctedLower.tracePath.slice(1, 4).map((point) => point.x)).toEqual([
    0.9, 0.9, 0.9,
  ])
  expect(correctedUpper.tracePath.slice(1, 4).map((point) => point.x)).toEqual([
    1.1, 1.1, 1.1,
  ])
})

test("chooses the simple-overlap separation with fewer intersections", () => {
  const outerTrace = makeTrace("outer", "outer-net", [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ])
  const innerTrace = makeTrace("inner", "inner-net", [
    { x: -1, y: -0.5 },
    { x: 0, y: -0.5 },
    { x: 0, y: 0.5 },
    { x: -1, y: 0.5 },
  ])
  const solver = createSolver([outerTrace, innerTrace])

  const issue = solver.findNextOverlapIssue()
  expect(issue?.interactionKind).toBe("overlap")
  expect(
    issue?.overlappingTraceSegments.map(
      (group) => group.pathsWithOverlap.length,
    ),
  ).toEqual([1, 1])

  solver.solve()

  const correctedOuter = solver.correctedTraceMap[outerTrace.mspPairId]!
  const correctedInner = solver.correctedTraceMap[innerTrace.mspPairId]!
  expect(
    countPathIntersections(correctedOuter.tracePath, correctedInner.tracePath),
  ).toBe(0)
  expect(correctedOuter.tracePath[1]!.x).toBeCloseTo(0.1)
  expect(correctedInner.tracePath[1]!.x).toBeCloseTo(-0.1)
})

test("chooses the point-contact separation direction with fewer intersections", () => {
  const innerTrace = makeTrace("inner", "inner-net", [
    { x: 1.25, y: 0.825 },
    { x: 1.45, y: 0.825 },
    { x: 1.45, y: 0 },
    { x: -1.45, y: 0 },
    { x: -1.45, y: -0.825 },
    { x: -1.25, y: -0.825 },
  ])
  const exteriorTrace = makeTrace("exterior", "exterior-net", [
    { x: 0.5, y: -0.725 },
    { x: -0.075, y: -0.725 },
    { x: -0.075, y: -1.365 },
    { x: -1.45, y: -1.365 },
    { x: -1.45, y: -0.825 },
    { x: -1.65, y: -0.825 },
  ])
  const solver = createSolver([innerTrace, exteriorTrace])

  solver.solve()

  const correctedInner = solver.correctedTraceMap[innerTrace.mspPairId]!
  const correctedExterior = solver.correctedTraceMap[exteriorTrace.mspPairId]!
  expect(
    countPathIntersections(
      correctedInner.tracePath,
      correctedExterior.tracePath,
    ),
  ).toBe(0)
  expect(correctedExterior.tracePath[3]!.x).toBeLessThan(
    correctedInner.tracePath[3]!.x,
  )
})
