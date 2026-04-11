import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "../TraceCleanupSolver/simplifyPath"
import {
  isHorizontal,
  isVertical,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.15
const MAX_PASSES = 8

type Orientation = "horizontal" | "vertical"

type SegmentRef = {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  axisCoord: number
  rangeStart: number
  rangeEnd: number
  canMove: boolean
  span: number
}

export class SameNetSegmentMergingSolver extends BaseSolver {
  inputProblem: InputProblem
  mergeDistance: number
  outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    allTraces: SolvedTracePath[]
    mergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.outputTraces = params.allTraces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
      pins: trace.pins.map((pin) => ({ ...pin })) as typeof trace.pins,
    }))
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetSegmentMergingSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      allTraces: this.outputTraces,
      mergeDistance: this.mergeDistance,
    }
  }

  override _step() {
    let changed = false

    for (let passIndex = 0; passIndex < MAX_PASSES; passIndex++) {
      const passChanged = this.runMergePass()
      if (!passChanged) break
      changed = true
    }

    if (changed) {
      this.outputTraces = this.outputTraces.map((trace) => ({
        ...trace,
        tracePath: normalizePath(trace.tracePath),
      }))
    }

    this.solved = true
  }

  private runMergePass(): boolean {
    let changed = false
    const tracesByNet = new Map<string, number[]>()

    for (const [traceIndex, trace] of this.outputTraces.entries()) {
      if (!tracesByNet.has(trace.globalConnNetId)) {
        tracesByNet.set(trace.globalConnNetId, [])
      }
      tracesByNet.get(trace.globalConnNetId)!.push(traceIndex)
    }

    for (const traceIndexes of tracesByNet.values()) {
      if (traceIndexes.length < 2) continue

      for (const orientation of ["horizontal", "vertical"] as const) {
        changed =
          this.snapMovableSegmentsToAnchors(traceIndexes, orientation) ||
          changed
        changed =
          this.snapFreeSegmentsTogether(traceIndexes, orientation) || changed
      }
    }

    return changed
  }

  private snapMovableSegmentsToAnchors(
    traceIndexes: number[],
    orientation: Orientation,
  ): boolean {
    const segments = this.collectSegments(traceIndexes, orientation)
    const anchors = segments.filter((segment) => !segment.canMove)
    const movables = segments.filter((segment) => segment.canMove)

    if (anchors.length === 0 || movables.length === 0) return false

    const assignments = new Map<
      string,
      { targetCoord: number; distance: number }
    >()

    for (const segment of movables) {
      let bestAnchor: SegmentRef | null = null
      let bestDistance = Number.POSITIVE_INFINITY

      for (const anchor of anchors) {
        if (!areSegmentsCompatible(segment, anchor, this.mergeDistance))
          continue
        const distance = Math.abs(segment.axisCoord - anchor.axisCoord)
        if (distance + EPS < bestDistance) {
          bestDistance = distance
          bestAnchor = anchor
        }
      }

      if (bestAnchor) {
        assignments.set(getSegmentKey(segment), {
          targetCoord: bestAnchor.axisCoord,
          distance: bestDistance,
        })
      }
    }

    let changed = false
    for (const segment of movables) {
      const assignment = assignments.get(getSegmentKey(segment))
      if (!assignment) continue
      changed =
        this.applySegmentMove(segment, assignment.targetCoord) || changed
    }

    return changed
  }

  private snapFreeSegmentsTogether(
    traceIndexes: number[],
    orientation: Orientation,
  ): boolean {
    const segments = this.collectSegments(traceIndexes, orientation).filter(
      (segment) => segment.canMove,
    )

    if (segments.length < 2) return false

    const parent = segments.map((_, index) => index)
    const find = (index: number): number => {
      if (parent[index] !== index) {
        parent[index] = find(parent[index]!)
      }
      return parent[index]!
    }
    const union = (a: number, b: number) => {
      const rootA = find(a)
      const rootB = find(b)
      if (rootA !== rootB) parent[rootB] = rootA
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        if (
          areSegmentsCompatible(segments[i]!, segments[j]!, this.mergeDistance)
        ) {
          union(i, j)
        }
      }
    }

    const groups = new Map<number, SegmentRef[]>()
    for (let i = 0; i < segments.length; i++) {
      const root = find(i)
      if (!groups.has(root)) groups.set(root, [])
      groups.get(root)!.push(segments[i]!)
    }

    let changed = false

    for (const group of groups.values()) {
      if (group.length < 2) continue
      const totalSpan = group.reduce((sum, segment) => sum + segment.span, 0)
      if (totalSpan < EPS) continue

      const targetCoord =
        group.reduce(
          (sum, segment) => sum + segment.axisCoord * segment.span,
          0,
        ) / totalSpan

      for (const segment of group) {
        changed = this.applySegmentMove(segment, targetCoord) || changed
      }
    }

    return changed
  }

  private collectSegments(
    traceIndexes: number[],
    orientation: Orientation,
  ): SegmentRef[] {
    const segments: SegmentRef[] = []

    for (const traceIndex of traceIndexes) {
      const trace = this.outputTraces[traceIndex]!
      const lastPointIndex = trace.tracePath.length - 1

      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const a = trace.tracePath[segmentIndex]!
        const b = trace.tracePath[segmentIndex + 1]!

        const isMatchingOrientation =
          orientation === "horizontal"
            ? isHorizontal(a, b, EPS)
            : isVertical(a, b, EPS)
        if (!isMatchingOrientation) continue

        const rangeStart =
          orientation === "horizontal" ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
        const rangeEnd =
          orientation === "horizontal" ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
        const span = rangeEnd - rangeStart
        if (span < EPS) continue

        segments.push({
          traceIndex,
          segmentIndex,
          orientation,
          axisCoord: orientation === "horizontal" ? a.y : a.x,
          rangeStart,
          rangeEnd,
          canMove: segmentIndex > 0 && segmentIndex + 1 < lastPointIndex,
          span,
        })
      }
    }

    return segments
  }

  private applySegmentMove(segment: SegmentRef, targetCoord: number): boolean {
    if (!segment.canMove) return false
    if (Math.abs(segment.axisCoord - targetCoord) < EPS) return false

    const trace = this.outputTraces[segment.traceIndex]!
    const nextTracePath = trace.tracePath.map((point) => ({ ...point }))
    const startPoint = nextTracePath[segment.segmentIndex]!
    const endPoint = nextTracePath[segment.segmentIndex + 1]!

    if (segment.orientation === "horizontal") {
      startPoint.y = targetCoord
      endPoint.y = targetCoord
    } else {
      startPoint.x = targetCoord
      endPoint.x = targetCoord
    }

    this.outputTraces[segment.traceIndex] = {
      ...trace,
      tracePath: normalizePath(nextTracePath),
    }

    return true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "green",
      })
    }

    return graphics
  }
}

const areSegmentsCompatible = (
  a: SegmentRef,
  b: SegmentRef,
  mergeDistance: number,
): boolean => {
  if (a.traceIndex === b.traceIndex) return false
  if (a.orientation !== b.orientation) return false
  if (Math.abs(a.axisCoord - b.axisCoord) > mergeDistance + EPS) return false

  const overlap =
    Math.min(a.rangeEnd, b.rangeEnd) - Math.max(a.rangeStart, b.rangeStart)
  return overlap > EPS
}

const getSegmentKey = (segment: SegmentRef) =>
  `${segment.traceIndex}:${segment.segmentIndex}:${segment.orientation}`

const normalizePath = (path: Point[]): Point[] => {
  const deduped: Point[] = []

  for (const point of path) {
    const previous = deduped[deduped.length - 1]
    if (
      previous &&
      Math.abs(previous.x - point.x) < EPS &&
      Math.abs(previous.y - point.y) < EPS
    ) {
      continue
    }
    deduped.push({ ...point })
  }

  if (deduped.length <= 2) return deduped

  const simplified = simplifyPath(deduped)
  const finalPath: Point[] = []

  for (const point of simplified) {
    const previous = finalPath[finalPath.length - 1]
    if (
      previous &&
      Math.abs(previous.x - point.x) < EPS &&
      Math.abs(previous.y - point.y) < EPS
    ) {
      continue
    }
    finalPath.push({ ...point })
  }

  return finalPath
}
