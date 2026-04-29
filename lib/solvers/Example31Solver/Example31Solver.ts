import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { rectIntersectsAnyTrace } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import {
  getCenterFromAnchor,
  getDimsForOrientation,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

interface Example31SolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

type VccCornerCandidate = {
  anchorPoint: Point
  center: Point
  width: number
  height: number
}

const EPS = 1e-6
const COLLISION_TEST_OFFSET = 1e-4

export class Example31Solver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]

  private traceMap: Record<string, SolvedTracePath>
  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex

  constructor(params: Example31SolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = params.netLabelPlacements
    this.traceMap = Object.fromEntries(
      params.traces.map((trace) => [trace.mspPairId, trace]),
    )
    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof Example31Solver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    this.outputNetLabelPlacements = this.netLabelPlacements.map((label) =>
      this.getCorrectedLabel(label),
    )
    this.solved = true
  }

  getOutput() {
    return {
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getCorrectedLabel(label: NetLabelPlacement): NetLabelPlacement {
    if (label.netId !== "VCC") return label
    if (!this.isLabelOnTrace(label)) return label

    const candidate = this.findBestCornerCandidate(label)
    if (!candidate) return label

    const anchorPoint = candidate?.anchorPoint ?? label.anchorPoint
    const width = candidate?.width ?? label.width
    const height = candidate?.height ?? label.height

    return {
      ...label,
      orientation: "y+",
      anchorPoint,
      width,
      height,
      center: candidate.center,
    }
  }

  private findBestCornerCandidate(label: NetLabelPlacement) {
    const candidates = this.getCornerCandidates(label).filter((candidate) =>
      this.isCandidateCollisionFree(candidate),
    )
    if (candidates.length === 0) return null

    candidates.sort((a, b) => compareCandidates(a, b, label.anchorPoint))
    return candidates[0]!
  }

  private getCornerCandidates(label: NetLabelPlacement) {
    const candidates: VccCornerCandidate[] = []

    for (const trace of this.getLabelTraces(label)) {
      candidates.push(...this.getTraceCornerCandidates(trace, label))
    }

    return candidates
  }

  private getTraceCornerCandidates(
    trace: SolvedTracePath,
    label: NetLabelPlacement,
  ) {
    const candidates: VccCornerCandidate[] = []
    const { width, height } = getDimsForOrientation({
      orientation: "y+",
      netLabelWidth: this.getNetLabelWidth(label),
    })

    for (let i = 1; i < trace.tracePath.length - 1; i++) {
      const previousPoint = trace.tracePath[i - 1]!
      const cornerPoint = trace.tracePath[i]!
      const nextPoint = trace.tracePath[i + 1]!
      if (!isTraceCorner(previousPoint, cornerPoint, nextPoint)) continue
      if (!hasHorizontalSegment(previousPoint, cornerPoint, nextPoint)) continue

      candidates.push({
        anchorPoint: cornerPoint,
        center: getCenterFromAnchor(cornerPoint, "y+", width, height),
        width,
        height,
      })
    }

    return candidates
  }

  private getNetLabelWidth(label: NetLabelPlacement) {
    if (!label.netId) return undefined
    return this.inputProblem.netConnections.find(
      (connection) => connection.netId === label.netId,
    )?.netLabelWidth
  }

  private isLabelOnTrace(label: NetLabelPlacement) {
    return this.getLabelTraces(label).some((trace) =>
      tracePathContainsPoint(trace.tracePath, label.anchorPoint),
    )
  }

  private getLabelTraces(label: NetLabelPlacement) {
    const traceIds = new Set(label.mspConnectionPairIds)
    if (traceIds.size > 0) {
      return this.traces.filter((trace) => traceIds.has(trace.mspPairId))
    }

    return this.traces.filter(
      (trace) => trace.globalConnNetId === label.globalConnNetId,
    )
  }

  private isCandidateCollisionFree(candidate: VccCornerCandidate) {
    const testCenter = {
      x: candidate.center.x,
      y: candidate.center.y + COLLISION_TEST_OFFSET,
    }
    const bounds = getRectBounds(testCenter, candidate.width, candidate.height)
    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return false
    }

    return !rectIntersectsAnyTrace(bounds, this.traceMap).hasIntersection
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of this.traces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    for (const label of this.outputNetLabelPlacements) {
      graphics.rects!.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      } as any)
      graphics.points!.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      } as any)
    }

    return graphics
  }
}

const isTraceCorner = (a: Point, b: Point, c: Point) =>
  getSegmentOrientation(a, b) !== getSegmentOrientation(b, c)

const hasHorizontalSegment = (a: Point, b: Point, c: Point) =>
  getSegmentOrientation(a, b) === "horizontal" ||
  getSegmentOrientation(b, c) === "horizontal"

const tracePathContainsPoint = (path: Point[], point: Point) => {
  for (let i = 0; i < path.length - 1; i++) {
    if (isPointOnSegment(point, path[i]!, path[i + 1]!)) return true
  }
  return false
}

const isPointOnSegment = (point: Point, start: Point, end: Point) => {
  if (getSegmentOrientation(start, end) === "horizontal") {
    return (
      Math.abs(point.y - start.y) <= EPS &&
      point.x >= Math.min(start.x, end.x) - EPS &&
      point.x <= Math.max(start.x, end.x) + EPS
    )
  }

  return (
    Math.abs(point.x - start.x) <= EPS &&
    point.y >= Math.min(start.y, end.y) - EPS &&
    point.y <= Math.max(start.y, end.y) + EPS
  )
}

const getSegmentOrientation = (a: Point, b: Point) =>
  Math.abs(a.y - b.y) <= EPS ? "horizontal" : "vertical"

const compareCandidates = (
  a: VccCornerCandidate,
  b: VccCornerCandidate,
  currentAnchor: Point,
) => {
  if (Math.abs(a.anchorPoint.y - b.anchorPoint.y) > EPS) {
    return b.anchorPoint.y - a.anchorPoint.y
  }

  return (
    getDistance(a.anchorPoint, currentAnchor) -
    getDistance(b.anchorPoint, currentAnchor)
  )
}

const getDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
