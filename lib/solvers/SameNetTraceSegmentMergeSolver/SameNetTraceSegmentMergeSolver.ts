import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import type { InputProblem } from "lib/types/InputProblem"

type Orientation = "horizontal" | "vertical"

interface SameNetTraceSegmentMergeSolverInput {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  maxMergeDistance?: number
  minOverlap?: number
}

interface SegmentRef {
  traceIndex: number
  mspPairId: string
  segmentIndex: number
  orientation: Orientation
  coordinate: number
  min: number
  max: number
  length: number
  globalConnNetId: string
}

interface MergeCandidate {
  source: SegmentRef
  target: SegmentRef
  distance: number
  overlap: number
}

const EPS = 1e-6
const DEFAULT_MAX_MERGE_DISTANCE = 0.15
const DEFAULT_MIN_OVERLAP = 0.05

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const clonePoint = (p: Point): Point => ({ x: p.x, y: p.y })

const dedupeAdjacentPoints = (path: Point[]): Point[] => {
  const deduped: Point[] = []
  for (const point of path) {
    const last = deduped[deduped.length - 1]
    if (!last || !pointsEqual(last, point)) {
      deduped.push(point)
    }
  }
  return deduped
}

const normalizePath = (path: Point[]): Point[] =>
  dedupeAdjacentPoints(simplifyPath(dedupeAdjacentPoints(path)))

const isOrthogonalPath = (path: Point[]) =>
  path.every((point, index) => {
    if (index === 0) return true
    const prev = path[index - 1]!
    return isHorizontal(prev, point, EPS) || isVertical(prev, point, EPS)
  })

const pushPoint = (path: Point[], point: Point) => {
  const last = path[path.length - 1]
  if (!last || !pointsEqual(last, point)) {
    path.push(clonePoint(point))
  }
}

const appendOrthogonalTransition = (
  path: Point[],
  point: Point,
  preferredOrientation: Orientation,
) => {
  const last = path[path.length - 1]
  if (!last) {
    pushPoint(path, point)
    return
  }

  if (
    pointsEqual(last, point) ||
    isHorizontal(last, point, EPS) ||
    isVertical(last, point, EPS)
  ) {
    pushPoint(path, point)
    return
  }

  const elbow =
    preferredOrientation === "horizontal"
      ? { x: point.x, y: last.y }
      : { x: last.x, y: point.y }
  pushPoint(path, elbow)
  pushPoint(path, point)
}

const getAlignedPoint = (
  point: Point,
  orientation: Orientation,
  coordinate: number,
): Point =>
  orientation === "horizontal"
    ? { x: point.x, y: coordinate }
    : { x: coordinate, y: point.y }

const replaceSegmentCoordinate = (
  path: Point[],
  segmentIndex: number,
  orientation: Orientation,
  coordinate: number,
): Point[] => {
  const result: Point[] = []

  if (segmentIndex === 0) {
    pushPoint(result, path[0]!)
  } else {
    for (let i = 0; i < segmentIndex; i++) {
      pushPoint(result, path[i]!)
    }
  }

  const alignedStart = getAlignedPoint(
    path[segmentIndex]!,
    orientation,
    coordinate,
  )
  const alignedEnd = getAlignedPoint(
    path[segmentIndex + 1]!,
    orientation,
    coordinate,
  )

  appendOrthogonalTransition(result, alignedStart, orientation)
  pushPoint(result, alignedEnd)

  if (segmentIndex + 1 === path.length - 1) {
    appendOrthogonalTransition(result, path[path.length - 1]!, orientation)
  } else {
    for (let i = segmentIndex + 2; i < path.length; i++) {
      appendOrthogonalTransition(result, path[i]!, orientation)
    }
  }

  const normalized = normalizePath(result)
  return normalizePath(normalized)
}

const segmentOverlap = (a: SegmentRef, b: SegmentRef) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

/**
 * Aligns close parallel trace segments that belong to the same net so skinny
 * same-net loops collapse into a single shared line before labels are placed.
 */
export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  maxMergeDistance: number
  minOverlap: number
  correctedTraceMap: Record<string, SolvedTracePath> = {}

  constructor(params: SameNetTraceSegmentMergeSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.maxMergeDistance =
      params.maxMergeDistance ?? DEFAULT_MAX_MERGE_DISTANCE
    this.minOverlap = params.minOverlap ?? DEFAULT_MIN_OVERLAP

    for (const trace of params.inputTracePaths) {
      this.correctedTraceMap[trace.mspPairId] = {
        ...trace,
        tracePath: trace.tracePath.map(clonePoint),
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      maxMergeDistance: this.maxMergeDistance,
      minOverlap: this.minOverlap,
    }
  }

  private getCurrentTraces(): SolvedTracePath[] {
    return this.inputTracePaths.map(
      (trace) => this.correctedTraceMap[trace.mspPairId]!,
    )
  }

  private getSegments(): SegmentRef[] {
    const segments: SegmentRef[] = []
    for (const [traceIndex, trace] of this.getCurrentTraces().entries()) {
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const start = trace.tracePath[segmentIndex]!
        const end = trace.tracePath[segmentIndex + 1]!
        const horizontal = isHorizontal(start, end, EPS)
        const vertical = isVertical(start, end, EPS)
        if (!horizontal && !vertical) continue

        const orientation: Orientation = horizontal ? "horizontal" : "vertical"
        const coordinate = horizontal ? start.y : start.x
        const startValue = horizontal ? start.x : start.y
        const endValue = horizontal ? end.x : end.y
        const min = Math.min(startValue, endValue)
        const max = Math.max(startValue, endValue)
        const length = max - min
        if (length < EPS) continue

        segments.push({
          traceIndex,
          mspPairId: trace.mspPairId,
          segmentIndex,
          orientation,
          coordinate,
          min,
          max,
          length,
          globalConnNetId: trace.globalConnNetId,
        })
      }
    }
    return segments
  }

  private findBestMergeCandidate(): MergeCandidate | null {
    const segments = this.getSegments()
    let bestCandidate: MergeCandidate | null = null

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.globalConnNetId !== b.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue

        const distance = Math.abs(a.coordinate - b.coordinate)
        if (distance < EPS || distance > this.maxMergeDistance) continue

        const overlap = segmentOverlap(a, b)
        if (overlap < this.minOverlap) continue

        const [target, source] = a.length >= b.length ? [a, b] : [b, a]
        const candidate = { source, target, distance, overlap }

        if (
          !bestCandidate ||
          candidate.distance < bestCandidate.distance - EPS ||
          (Math.abs(candidate.distance - bestCandidate.distance) < EPS &&
            candidate.overlap > bestCandidate.overlap)
        ) {
          bestCandidate = candidate
        }
      }
    }

    return bestCandidate
  }

  private applyMergeCandidate(candidate: MergeCandidate): boolean {
    const traces = this.getCurrentTraces()
    const sourceTrace = traces[candidate.source.traceIndex]!
    const previousPath = sourceTrace.tracePath
    const nextPath = replaceSegmentCoordinate(
      previousPath,
      candidate.source.segmentIndex,
      candidate.source.orientation,
      candidate.target.coordinate,
    )

    if (nextPath.length < 2 || !isOrthogonalPath(nextPath)) {
      return false
    }

    if (
      !pointsEqual(previousPath[0]!, nextPath[0]!) ||
      !pointsEqual(
        previousPath[previousPath.length - 1]!,
        nextPath[nextPath.length - 1]!,
      )
    ) {
      return false
    }

    if (
      nextPath.length === previousPath.length &&
      nextPath.every((point, index) => pointsEqual(point, previousPath[index]!))
    ) {
      return false
    }

    this.correctedTraceMap[sourceTrace.mspPairId] = {
      ...sourceTrace,
      tracePath: nextPath,
    }
    this.stats.mergedSegmentCount = (this.stats.mergedSegmentCount ?? 0) + 1
    return true
  }

  override _step() {
    let mergesApplied = 0

    while (mergesApplied < 100) {
      const candidate = this.findBestMergeCandidate()
      if (!candidate) break
      if (!this.applyMergeCandidate(candidate)) break
      mergesApplied++
    }

    this.solved = true
  }

  getOutput() {
    return {
      traces: this.getCurrentTraces(),
      correctedTraceMap: this.correctedTraceMap,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.getCurrentTraces()) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}
