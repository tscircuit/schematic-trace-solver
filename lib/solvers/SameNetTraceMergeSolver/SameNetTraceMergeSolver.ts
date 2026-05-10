import type { Point } from "@tscircuit/math-utils"
import {
  doSegmentsIntersect,
  getSegmentIntersection,
} from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Orientation = "horizontal" | "vertical"

export interface SameNetTraceMergeSolverParams {
  inputTraces: SolvedTracePath[]
  mergeDistance?: number
  minParallelOverlap?: number
}

type MovableSegment = {
  traceId: string
  segmentIndex: number
  globalConnNetId: string
  orientation: Orientation
  axis: number
  min: number
  max: number
  length: number
}

export type MergeStats = {
  mergedSegmentGroups: number
  mergedSegments: number
  skippedUnsafeGroups: number
}

const DEFAULT_MERGE_DISTANCE = 0.15
const DEFAULT_MIN_PARALLEL_OVERLAP = 0.05
const EPS = 1e-6

export class SameNetTraceMergeSolver extends BaseSolver {
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergeDistance: number
  minParallelOverlap: number

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.inputTraces = params.inputTraces
    this.outputTraces = cloneTraces(params.inputTraces)
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.minParallelOverlap =
      params.minParallelOverlap ?? DEFAULT_MIN_PARALLEL_OVERLAP
    this.stats = {
      mergedSegmentGroups: 0,
      mergedSegments: 0,
      skippedUnsafeGroups: 0,
    }
  }

  override _step() {
    const stats: MergeStats = {
      mergedSegmentGroups: 0,
      mergedSegments: 0,
      skippedUnsafeGroups: 0,
    }

    this.outputTraces = mergeCloseSameNetTraceSegments(this.inputTraces, {
      mergeDistance: this.mergeDistance,
      minParallelOverlap: this.minParallelOverlap,
      stats,
    })
    this.stats = stats
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}

export const mergeCloseSameNetTraceSegments = (
  inputTraces: SolvedTracePath[],
  opts: {
    mergeDistance?: number
    minParallelOverlap?: number
    stats?: MergeStats
  } = {},
): SolvedTracePath[] => {
  const stats = opts.stats
  const mergeDistance = opts.mergeDistance ?? DEFAULT_MERGE_DISTANCE
  const minParallelOverlap =
    opts.minParallelOverlap ?? DEFAULT_MIN_PARALLEL_OVERLAP
  const components = findMergeComponents(inputTraces, {
    mergeDistance,
    minParallelOverlap,
  })

  let outputTraces = cloneTraces(inputTraces)

  for (const component of components) {
    const proposedTraces = cloneTraces(outputTraces)
    applyComponentMerge(proposedTraces, component)

    if (introducesDifferentNetIntersection(outputTraces, proposedTraces)) {
      if (stats) stats.skippedUnsafeGroups++
      continue
    }

    outputTraces = proposedTraces
    if (stats) {
      stats.mergedSegmentGroups++
      stats.mergedSegments += component.length
    }
  }

  return outputTraces
}

const cloneTraces = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
    mspConnectionPairIds: [...trace.mspConnectionPairIds],
    pinIds: [...trace.pinIds],
  }))

const findMergeComponents = (
  traces: SolvedTracePath[],
  opts: { mergeDistance: number; minParallelOverlap: number },
): MovableSegment[][] => {
  const segments = getMovableSegments(traces)
  const groups = new Map<string, MovableSegment[]>()

  for (const segment of segments) {
    const key = `${segment.globalConnNetId}:${segment.orientation}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(segment)
  }

  return Array.from(groups.values()).flatMap((group) =>
    getConnectedSegmentComponents(group, opts),
  )
}

const getConnectedSegmentComponents = (
  segments: MovableSegment[],
  opts: { mergeDistance: number; minParallelOverlap: number },
): MovableSegment[][] => {
  const parents = segments.map((_, index) => index)

  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]!]!
      index = parents[index]!
    }
    return index
  }

  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parents[rootB] = rootA
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (canMergeSegments(segments[i]!, segments[j]!, opts)) {
        union(i, j)
      }
    }
  }

  const byRoot = new Map<number, MovableSegment[]>()
  for (let i = 0; i < segments.length; i++) {
    const root = find(i)
    if (!byRoot.has(root)) byRoot.set(root, [])
    byRoot.get(root)!.push(segments[i]!)
  }

  return Array.from(byRoot.values()).filter((component) => {
    const traceIds = new Set(component.map((segment) => segment.traceId))
    return component.length > 1 && traceIds.size > 1
  })
}

const canMergeSegments = (
  a: MovableSegment,
  b: MovableSegment,
  opts: { mergeDistance: number; minParallelOverlap: number },
): boolean => {
  if (a.traceId === b.traceId) return false
  if (a.globalConnNetId !== b.globalConnNetId) return false
  if (a.orientation !== b.orientation) return false
  if (Math.abs(a.axis - b.axis) > opts.mergeDistance) return false

  const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min)
  return overlap >= opts.minParallelOverlap
}

const getMovableSegments = (traces: SolvedTracePath[]): MovableSegment[] => {
  const segments: MovableSegment[] = []

  for (const trace of traces) {
    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const orientation = getSegmentOrientation(
        trace.tracePath[segmentIndex]!,
        trace.tracePath[segmentIndex + 1]!,
      )

      if (!orientation) continue
      if (!canMoveSegment(trace.tracePath, segmentIndex, orientation)) continue

      const p1 = trace.tracePath[segmentIndex]!
      const p2 = trace.tracePath[segmentIndex + 1]!
      const axis = orientation === "horizontal" ? p1.y : p1.x
      const values = orientation === "horizontal" ? [p1.x, p2.x] : [p1.y, p2.y]

      segments.push({
        traceId: trace.mspPairId,
        segmentIndex,
        globalConnNetId: trace.globalConnNetId,
        orientation,
        axis,
        min: Math.min(...values),
        max: Math.max(...values),
        length: Math.abs(values[1]! - values[0]!),
      })
    }
  }

  return segments
}

const canMoveSegment = (
  tracePath: Point[],
  segmentIndex: number,
  orientation: Orientation,
): boolean => {
  if (segmentIndex === 0 || segmentIndex >= tracePath.length - 2) {
    return false
  }

  const prevOrientation = getSegmentOrientation(
    tracePath[segmentIndex - 1]!,
    tracePath[segmentIndex]!,
  )
  const nextOrientation = getSegmentOrientation(
    tracePath[segmentIndex + 1]!,
    tracePath[segmentIndex + 2]!,
  )

  return (
    prevOrientation != null &&
    nextOrientation != null &&
    prevOrientation !== orientation &&
    nextOrientation !== orientation
  )
}

const getSegmentOrientation = (p1: Point, p2: Point): Orientation | null => {
  if (Math.abs(p1.y - p2.y) <= EPS && Math.abs(p1.x - p2.x) > EPS) {
    return "horizontal"
  }

  if (Math.abs(p1.x - p2.x) <= EPS && Math.abs(p1.y - p2.y) > EPS) {
    return "vertical"
  }

  return null
}

const applyComponentMerge = (
  traces: SolvedTracePath[],
  component: MovableSegment[],
) => {
  const targetAxis = getWeightedTargetAxis(component)
  const traceMap = new Map(traces.map((trace) => [trace.mspPairId, trace]))

  for (const segment of component) {
    const trace = traceMap.get(segment.traceId)
    if (!trace) continue

    const p1 = trace.tracePath[segment.segmentIndex]!
    const p2 = trace.tracePath[segment.segmentIndex + 1]!
    if (segment.orientation === "horizontal") {
      p1.y = targetAxis
      p2.y = targetAxis
    } else {
      p1.x = targetAxis
      p2.x = targetAxis
    }
  }
}

const getWeightedTargetAxis = (component: MovableSegment[]) => {
  const totalLength = component.reduce(
    (sum, segment) => sum + segment.length,
    0,
  )
  if (totalLength <= EPS) {
    return (
      component.reduce((sum, segment) => sum + segment.axis, 0) /
      component.length
    )
  }

  return (
    component.reduce((sum, segment) => sum + segment.axis * segment.length, 0) /
    totalLength
  )
}

const introducesDifferentNetIntersection = (
  beforeTraces: SolvedTracePath[],
  afterTraces: SolvedTracePath[],
) => {
  const beforeById = new Map(
    beforeTraces.map((trace) => [trace.mspPairId, trace]),
  )

  for (const afterTrace of afterTraces) {
    const beforeTrace = beforeById.get(afterTrace.mspPairId)
    if (!beforeTrace) continue
    if (sameTracePath(beforeTrace.tracePath, afterTrace.tracePath)) continue

    const beforeIntersections = getDifferentNetIntersectionKeys(
      beforeTrace,
      beforeTraces,
    )
    const afterIntersections = getDifferentNetIntersectionKeys(
      afterTrace,
      afterTraces,
    )

    for (const key of afterIntersections) {
      if (!beforeIntersections.has(key)) return true
    }
  }

  return false
}

const getDifferentNetIntersectionKeys = (
  trace: SolvedTracePath,
  allTraces: SolvedTracePath[],
) => {
  const intersections = new Set<string>()

  for (
    let segmentIndex = 0;
    segmentIndex < trace.tracePath.length - 1;
    segmentIndex++
  ) {
    const p1 = trace.tracePath[segmentIndex]!
    const p2 = trace.tracePath[segmentIndex + 1]!

    for (const otherTrace of allTraces) {
      if (otherTrace.mspPairId === trace.mspPairId) continue
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

      for (
        let otherSegmentIndex = 0;
        otherSegmentIndex < otherTrace.tracePath.length - 1;
        otherSegmentIndex++
      ) {
        const o1 = otherTrace.tracePath[otherSegmentIndex]!
        const o2 = otherTrace.tracePath[otherSegmentIndex + 1]!

        if (!doSegmentsIntersect(p1, p2, o1, o2)) continue

        const intersection = getSegmentIntersection(p1, p2, o1, o2)
        const intersectionKey = intersection
          ? `${round(intersection.x)},${round(intersection.y)}`
          : "parallel-overlap"
        intersections.add(
          `${otherTrace.mspPairId}:${otherSegmentIndex}:${intersectionKey}`,
        )
      }
    }
  }

  return intersections
}

const sameTracePath = (a: Point[], b: Point[]) =>
  a.length === b.length &&
  a.every((point, index) => {
    const otherPoint = b[index]!
    return (
      Math.abs(point.x - otherPoint.x) <= EPS &&
      Math.abs(point.y - otherPoint.y) <= EPS
    )
  })

const round = (value: number) => Math.round(value * 1e6) / 1e6
