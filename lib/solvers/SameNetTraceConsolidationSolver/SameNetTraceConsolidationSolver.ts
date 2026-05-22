import type { Point } from "@tscircuit/math-utils"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
  segmentIntersectsRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

type Axis = "horizontal" | "vertical"

type SegmentRef = {
  mspPairId: MspConnectionPairId
  segmentIndex: number
  axis: Axis
  coord: number
  min: number
  max: number
  length: number
  stableKey: string
}

export interface SameNetTraceConsolidationSolverInput {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  mergeDistance?: number
  intervalGap?: number
}

const DEFAULT_MERGE_DISTANCE = 0.12
const DEFAULT_INTERVAL_GAP = 0.12
const EPS = 1e-6

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  pins: [{ ...trace.pins[0] }, { ...trace.pins[1] }],
  pinIds: [...trace.pinIds],
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  tracePath: trace.tracePath.map((p) => ({ ...p })),
})

const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const dedupePath = (path: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const point of path) {
    if (
      deduped.length === 0 ||
      !samePoint(deduped[deduped.length - 1]!, point)
    ) {
      deduped.push(point)
    }
  }
  return deduped
}

const normalizePath = (path: Point[]) =>
  dedupePath(simplifyPath(dedupePath(path)))

const intervalDistance = (a: SegmentRef, b: SegmentRef) =>
  Math.max(0, Math.max(a.min, b.min) - Math.min(a.max, b.max))

const segmentRefsCompatible = (
  a: SegmentRef,
  b: SegmentRef,
  mergeDistance: number,
  intervalGap: number,
) =>
  a.axis === b.axis &&
  a.mspPairId !== b.mspPairId &&
  Math.abs(a.coord - b.coord) <= mergeDistance &&
  intervalDistance(a, b) <= intervalGap

const compareSegmentRefs = (a: SegmentRef, b: SegmentRef) =>
  a.axis.localeCompare(b.axis) ||
  a.coord - b.coord ||
  a.min - b.min ||
  a.max - b.max ||
  a.mspPairId.localeCompare(b.mspPairId) ||
  a.segmentIndex - b.segmentIndex

const chooseCanonicalSegment = (segments: SegmentRef[]) =>
  [...segments].sort(
    (a, b) =>
      b.length - a.length ||
      a.stableKey.localeCompare(b.stableKey) ||
      a.segmentIndex - b.segmentIndex,
  )[0]!

const getSegmentRefs = (trace: SolvedTracePath): SegmentRef[] => {
  const refs: SegmentRef[] = []
  const pts = trace.tracePath

  for (let i = 0; i < pts.length - 1; i++) {
    const start = pts[i]!
    const end = pts[i + 1]!
    if (samePoint(start, end)) continue

    if (isHorizontal(start, end, EPS)) {
      const min = Math.min(start.x, end.x)
      const max = Math.max(start.x, end.x)
      refs.push({
        mspPairId: trace.mspPairId,
        segmentIndex: i,
        axis: "horizontal",
        coord: start.y,
        min,
        max,
        length: max - min,
        stableKey: `${trace.mspPairId}:${i}`,
      })
    } else if (isVertical(start, end, EPS)) {
      const min = Math.min(start.y, end.y)
      const max = Math.max(start.y, end.y)
      refs.push({
        mspPairId: trace.mspPairId,
        segmentIndex: i,
        axis: "vertical",
        coord: start.x,
        min,
        max,
        length: max - min,
        stableKey: `${trace.mspPairId}:${i}`,
      })
    }
  }

  return refs
}

const clusterSegments = (
  refs: SegmentRef[],
  mergeDistance: number,
  intervalGap: number,
) => {
  const parent = refs.map((_, index) => index)
  const find = (index: number): number => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]!]!
      index = parent[index]!
    }
    return index
  }
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let i = 0; i < refs.length; i++) {
    for (let j = i + 1; j < refs.length; j++) {
      if (
        segmentRefsCompatible(refs[i]!, refs[j]!, mergeDistance, intervalGap)
      ) {
        union(i, j)
      }
    }
  }

  const clusters = new Map<number, SegmentRef[]>()
  for (let i = 0; i < refs.length; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(refs[i]!)
  }

  return Array.from(clusters.values()).filter((cluster) => cluster.length > 1)
}

const hasOnlyOrthogonalSegments = (path: Point[]) => {
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    if (samePoint(start, end)) continue
    if (!isHorizontal(start, end, EPS) && !isVertical(start, end, EPS)) {
      return false
    }
  }
  return true
}

const countChipCollisions = (path: Point[], inputProblem: InputProblem) => {
  const rects = getObstacleRects(inputProblem)
  let count = 0
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i]!
    const end = path[i + 1]!
    for (const rect of rects) {
      if (segmentIntersectsRect(start, end, rect, EPS)) count++
    }
  }
  return count
}

const countDifferentNetIntersections = (
  trace: SolvedTracePath,
  path: Point[],
  traces: SolvedTracePath[],
) => {
  let count = 0
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    for (const otherTrace of traces) {
      if (
        otherTrace.mspPairId === trace.mspPairId ||
        otherTrace.globalConnNetId === trace.globalConnNetId
      ) {
        continue
      }
      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        const c = otherTrace.tracePath[j]!
        const d = otherTrace.tracePath[j + 1]!
        if (doSegmentsIntersect(a, b, c, d)) count++
      }
    }
  }
  return count
}

const snappedPathForSegment = (
  trace: SolvedTracePath,
  segment: SegmentRef,
  coord: number,
): Point[] | null => {
  if (Math.abs(segment.coord - coord) < EPS) return null

  const pts = trace.tracePath.map((p) => ({ ...p }))
  const segmentStart = pts[segment.segmentIndex]!
  const segmentEnd = pts[segment.segmentIndex + 1]!
  const lastIndex = pts.length - 1
  const isFirstSegment = segment.segmentIndex === 0
  const isLastSegment = segment.segmentIndex + 1 === lastIndex

  if (isFirstSegment && isLastSegment) return null

  if (segment.axis === "horizontal") {
    if (isFirstSegment) {
      pts.splice(
        1,
        1,
        { x: segmentStart.x, y: coord },
        { x: segmentEnd.x, y: coord },
      )
    } else if (isLastSegment) {
      pts.splice(
        segment.segmentIndex,
        1,
        { x: segmentStart.x, y: coord },
        { x: segmentEnd.x, y: coord },
      )
    } else {
      segmentStart.y = coord
      segmentEnd.y = coord
    }
  } else {
    if (isFirstSegment) {
      pts.splice(
        1,
        1,
        { x: coord, y: segmentStart.y },
        { x: coord, y: segmentEnd.y },
      )
    } else if (isLastSegment) {
      pts.splice(
        segment.segmentIndex,
        1,
        { x: coord, y: segmentStart.y },
        { x: coord, y: segmentEnd.y },
      )
    } else {
      segmentStart.x = coord
      segmentEnd.x = coord
    }
  }

  return normalizePath(pts)
}

export class SameNetTraceConsolidationSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  mergeDistance: number
  intervalGap: number

  outputTraces: SolvedTracePath[]
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  constructor(params: SameNetTraceConsolidationSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.intervalGap = params.intervalGap ?? DEFAULT_INTERVAL_GAP

    this.outputTraces = params.inputTraces.map(cloneTrace)
    this.correctedTraceMap = Object.fromEntries(
      this.outputTraces.map((trace) => [trace.mspPairId, trace]),
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceConsolidationSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
      mergeDistance: this.mergeDistance,
      intervalGap: this.intervalGap,
    }
  }

  override _step() {
    let changed = true
    let guard = 0
    while (changed && guard < 1000) {
      guard++
      changed = this.applyNextConsolidationPass()
    }

    this.solved = true
  }

  private applyNextConsolidationPass() {
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      if (!tracesByNet.has(trace.globalConnNetId)) {
        tracesByNet.set(trace.globalConnNetId, [])
      }
      tracesByNet.get(trace.globalConnNetId)!.push(trace)
    }

    for (const globalConnNetId of [...tracesByNet.keys()].sort()) {
      const netTraces = tracesByNet.get(globalConnNetId)!
      for (const axis of ["horizontal", "vertical"] as const) {
        const refs = netTraces
          .flatMap(getSegmentRefs)
          .filter((ref) => ref.axis === axis)
          .sort(compareSegmentRefs)

        const clusters = clusterSegments(
          refs,
          this.mergeDistance,
          this.intervalGap,
        ).sort((a, b) => compareSegmentRefs(a[0]!, b[0]!))

        for (const cluster of clusters) {
          const canonical = chooseCanonicalSegment(cluster)
          const targets = cluster
            .filter((segment) => segment.stableKey !== canonical.stableKey)
            .sort(
              (a, b) =>
                a.length - b.length || a.stableKey.localeCompare(b.stableKey),
            )

          let changed = false
          const updatedTraceIds = new Set<MspConnectionPairId>()
          for (const target of targets) {
            if (updatedTraceIds.has(target.mspPairId)) continue
            const trace = this.correctedTraceMap[target.mspPairId]
            if (!trace) continue
            const candidatePath = snappedPathForSegment(
              trace,
              target,
              canonical.coord,
            )
            if (!candidatePath) continue
            if (!this.isCandidateSafe(trace, candidatePath)) continue

            const updatedTrace = {
              ...trace,
              tracePath: candidatePath,
            }
            this.correctedTraceMap[trace.mspPairId] = updatedTrace
            this.outputTraces = this.outputTraces.map((existingTrace) =>
              existingTrace.mspPairId === trace.mspPairId
                ? updatedTrace
                : existingTrace,
            )
            updatedTraceIds.add(trace.mspPairId)
            changed = true
          }

          if (changed) return true
        }
      }
    }

    return false
  }

  private isCandidateSafe(trace: SolvedTracePath, path: Point[]) {
    if (path.length < 2) return false
    if (!samePoint(path[0]!, trace.tracePath[0]!)) return false
    if (
      !samePoint(
        path[path.length - 1]!,
        trace.tracePath[trace.tracePath.length - 1]!,
      )
    ) {
      return false
    }
    if (!hasOnlyOrthogonalSegments(path)) return false

    const originalChipCollisions = countChipCollisions(
      trace.tracePath,
      this.inputProblem,
    )
    const candidateChipCollisions = countChipCollisions(path, this.inputProblem)
    if (candidateChipCollisions > originalChipCollisions) return false

    const originalDifferentNetIntersections = countDifferentNetIntersections(
      trace,
      trace.tracePath,
      this.outputTraces,
    )
    const candidateDifferentNetIntersections = countDifferentNetIntersections(
      trace,
      path,
      this.outputTraces,
    )
    if (
      candidateDifferentNetIntersections > originalDifferentNetIntersections
    ) {
      return false
    }

    return true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      correctedTraceMap: this.correctedTraceMap,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.inputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "rgba(120,120,120,0.45)",
        strokeDash: "4 2",
      })
    }

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: getColorFromString(trace.globalConnNetId, 0.9),
      })
    }

    return graphics
  }
}
