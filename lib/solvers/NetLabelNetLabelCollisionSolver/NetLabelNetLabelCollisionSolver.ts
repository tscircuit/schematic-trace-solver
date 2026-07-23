import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import {
  getDimsForOrientation,
  getCenterFromAnchor,
  getRectBounds,
} from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { rectIntersectsAnyTrace } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { rectIntersectsAnyTextBox } from "lib/utils/textBoxBounds"

type CandidateStatus =
  | "ok"
  | "chip-collision"
  | "text-collision"
  | "trace-collision"
  | "label-collision"

const ANCHOR_TRACE_CLEARANCE = 1e-4
const SEGMENT_PARALLEL_EPS = 1e-6
const CANDIDATE_STEP = 0.1
const FALLBACK_MIN_IMPROVEMENT = 1e-6
// A wire running through a label's text is far worse visually than two
// labels partially overlapping, so crossings dominate the penalty: length
// crossed × 10 always outweighs any plausible label-label overlap area.
const TRACE_CROSSING_PENALTY = 10

const OUTWARD_DIR: Record<FacingDirection, { x: number; y: number }> = {
  "x+": { x: 1, y: 0 },
  "x-": { x: -1, y: 0 },
  "y+": { x: 0, y: 1 },
  "y-": { x: 0, y: -1 },
}

const CANDIDATE_STATUS_COLOR: Record<CandidateStatus, string> = {
  ok: "green",
  "label-collision": "orange",
  "trace-collision": "darkorange",
  "chip-collision": "red",
  "text-collision": "purple",
}

const CANDIDATE_STATUS_FILL: Record<CandidateStatus, string> = {
  ok: "rgba(0, 200, 0, 0.25)",
  "label-collision": "rgba(255, 160, 0, 0.2)",
  "trace-collision": "rgba(200, 80, 0, 0.2)",
  "chip-collision": "rgba(220, 0, 0, 0.15)",
  "text-collision": "rgba(128, 0, 128, 0.15)",
}

type Candidate = {
  orientation: FacingDirection
  anchor: { x: number; y: number }
  center: { x: number; y: number }
  width: number
  height: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  hostPairId?: MspConnectionPairId
  hostSegIndex?: number
  status: CandidateStatus | null
}

function boundsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return (
    a.minX < b.maxX - 1e-9 &&
    a.maxX > b.minX + 1e-9 &&
    a.minY < b.maxY - 1e-9 &&
    a.maxY > b.minY + 1e-9
  )
}

function boundsOverlapArea(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  if (w <= 0 || h <= 0) return 0
  return w * h
}

function segmentLengthInsideBounds(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
): number {
  const isVert = Math.abs(p1.x - p2.x) < SEGMENT_PARALLEL_EPS
  const isHorz = Math.abs(p1.y - p2.y) < SEGMENT_PARALLEL_EPS
  if (isVert) {
    if (p1.x < bounds.minX || p1.x > bounds.maxX) return 0
    const segMinY = Math.min(p1.y, p2.y)
    const segMaxY = Math.max(p1.y, p2.y)
    return Math.max(
      0,
      Math.min(segMaxY, bounds.maxY) - Math.max(segMinY, bounds.minY),
    )
  }
  if (isHorz) {
    if (p1.y < bounds.minY || p1.y > bounds.maxY) return 0
    const segMinX = Math.min(p1.x, p2.x)
    const segMaxX = Math.max(p1.x, p2.x)
    return Math.max(
      0,
      Math.min(segMaxX, bounds.maxX) - Math.max(segMinX, bounds.minX),
    )
  }
  return 0
}

function isPointOnSegment(
  pt: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  eps = 1e-6,
): boolean {
  const cross = (p2.x - p1.x) * (pt.y - p1.y) - (p2.y - p1.y) * (pt.x - p1.x)
  if (Math.abs(cross) > eps) return false
  const dot = (pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)
  const lenSq = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2
  return dot >= -eps && dot <= lenSq + eps
}

function sampleAnchorsAlongSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(1, Math.round(len / CANDIDATE_STEP))
  const anchors: Array<{ x: number; y: number }> = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    anchors.push({ x: a.x + t * dx, y: a.y + t * dy })
  }
  return anchors
}

export interface NetLabelNetLabelCollisionSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

export class NetLabelNetLabelCollisionSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputNetLabelPlacements: NetLabelPlacement[]

  currentCollision: [NetLabelPlacement, NetLabelPlacement] | null = null
  currentLabelToMove: NetLabelPlacement | null = null
  candidateResults: Candidate[] = []

  private chipIndex: ChipObstacleSpatialIndex
  private traceMap: Record<MspConnectionPairId, SolvedTracePath>
  private skippedCollisionKeys = new Set<string>()

  private labelsToTry: NetLabelPlacement[] = []
  private candidateQueue: Candidate[] = []
  private candidateIndex = 0
  private currentLabelPenalty = Infinity
  private fallbackBest: {
    label: NetLabelPlacement
    candidate: Candidate
    improvement: number
  } | null = null

  constructor(params: NetLabelNetLabelCollisionSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.chipIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
    this.traceMap = Object.fromEntries(
      params.traces.map((t) => [t.mspPairId, t]),
    ) as Record<MspConnectionPairId, SolvedTracePath>
  }

  override getConstructorParams(): ConstructorParameters<
    typeof NetLabelNetLabelCollisionSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  getOutput() {
    return { netLabelPlacements: this.outputNetLabelPlacements }
  }

  private labelBounds(label: NetLabelPlacement) {
    return getRectBounds(label.center, label.width, label.height)
  }

  private collisionKey(a: NetLabelPlacement, b: NetLabelPlacement) {
    return [a.globalConnNetId, b.globalConnNetId].sort().join("::")
  }

  private findNextCollidingPair():
    | [NetLabelPlacement, NetLabelPlacement]
    | null {
    const labels = this.outputNetLabelPlacements
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!
        const b = labels[j]!
        if (a.globalConnNetId === b.globalConnNetId) continue
        if (this.skippedCollisionKeys.has(this.collisionKey(a, b))) continue
        if (boundsOverlap(this.labelBounds(a), this.labelBounds(b)))
          return [a, b]
      }
    }
    return null
  }

  private netLabelWidthOf(label: NetLabelPlacement): number | undefined {
    if (label.orientation === "x+" || label.orientation === "x-")
      return label.width
    return label.height
  }

  private netLabelHeightOf(label: NetLabelPlacement): number | undefined {
    if (label.orientation === "x+" || label.orientation === "x-")
      return label.height
    return label.width
  }

  private buildCandidatesForLabel(label: NetLabelPlacement): Candidate[] {
    const netLabelWidth = this.netLabelWidthOf(label)
    const netLabelHeight = this.netLabelHeightOf(label)
    const candidates: Candidate[] = []

    const buildCandidate = (
      orientation: FacingDirection,
      anchor: { x: number; y: number },
      hostPairId?: MspConnectionPairId,
      hostSegIndex?: number,
    ): Candidate => {
      const { width, height } = getDimsForOrientation({
        orientation,
        netLabelWidth,
        netLabelHeight,
      })
      const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
      const outwardDir = OUTWARD_DIR[orientation]
      const center = {
        x: baseCenter.x + outwardDir.x * ANCHOR_TRACE_CLEARANCE,
        y: baseCenter.y + outwardDir.y * ANCHOR_TRACE_CLEARANCE,
      }
      return {
        orientation,
        anchor,
        center,
        width,
        height,
        bounds: getRectBounds(center, width, height),
        hostPairId,
        hostSegIndex,
        status: null,
      }
    }

    const isPortOnly = label.mspConnectionPairIds.length === 0

    if (isPortOnly) {
      const allOrientations: FacingDirection[] = ["x+", "x-", "y+", "y-"]
      const orderedOrientations = [
        label.orientation,
        ...allOrientations.filter((o) => o !== label.orientation),
      ]
      for (const orientation of orderedOrientations) {
        candidates.push(buildCandidate(orientation, label.anchorPoint))
      }
    } else {
      for (const mspPairId of label.mspConnectionPairIds) {
        const trace = this.traceMap[mspPairId]
        if (!trace) continue
        const pts = trace.tracePath
        for (let si = 0; si < pts.length - 1; si++) {
          const segStart = pts[si]!
          const segEnd = pts[si + 1]!
          const isHorizontal =
            Math.abs(segStart.y - segEnd.y) < SEGMENT_PARALLEL_EPS
          const isVertical =
            Math.abs(segStart.x - segEnd.x) < SEGMENT_PARALLEL_EPS
          if (!isHorizontal && !isVertical) continue
          let perpendicularOrientations: FacingDirection[]
          if (isHorizontal) {
            perpendicularOrientations = ["y+", "y-"]
          } else {
            perpendicularOrientations = ["x+", "x-"]
          }
          for (const anchor of sampleAnchorsAlongSegment(segStart, segEnd)) {
            for (const orientation of perpendicularOrientations) {
              candidates.push(
                buildCandidate(
                  orientation,
                  anchor,
                  mspPairId as MspConnectionPairId,
                  si,
                ),
              )
            }
          }
        }
      }
    }

    return candidates
  }

  private checkCandidate(
    candidate: Candidate,
    movingLabelNetId: string,
    obstacleLabels: NetLabelPlacement[],
  ): CandidateStatus {
    const { bounds, hostPairId, hostSegIndex } = candidate

    if (this.chipIndex.getChipsInBounds(bounds).length > 0)
      return "chip-collision"
    if (rectIntersectsAnyTextBox(bounds, this.inputProblem))
      return "text-collision"

    if (
      rectIntersectsAnyTrace(bounds, this.traceMap, hostPairId, hostSegIndex)
        .hasIntersection
    ) {
      return "trace-collision"
    }

    for (const obstacle of obstacleLabels) {
      if (obstacle.globalConnNetId === movingLabelNetId) continue
      if (boundsOverlap(bounds, this.labelBounds(obstacle)))
        return "label-collision"
    }

    return "ok"
  }

  /**
   * Total "badness" of placing `label` at `bounds`/`anchor`: overlap area with
   * other labels plus weighted lengths of trace segments crossed. Only the
   * candidate's host segment (the one the anchor sits on, which the label
   * extends perpendicularly away from) is free — any other segment lying
   * inside the bounds reads as a label sitting on a wire, own net or not.
   * Chip/text collisions are disqualifying (Infinity).
   */
  private computePlacementPenalty(
    label: NetLabelPlacement,
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    anchor: { x: number; y: number },
    host?: { pairId: MspConnectionPairId; segIndex: number },
  ): number {
    if (this.chipIndex.getChipsInBounds(bounds).length > 0) return Infinity
    if (rectIntersectsAnyTextBox(bounds, this.inputProblem)) return Infinity

    let penalty = 0
    for (const obstacle of this.outputNetLabelPlacements) {
      if (obstacle === label) continue
      if (obstacle.globalConnNetId === label.globalConnNetId) continue
      penalty += boundsOverlapArea(bounds, this.labelBounds(obstacle))
    }
    for (const solved of this.traces) {
      const isOwnNet = solved.globalConnNetId === label.globalConnNetId
      const pts = solved.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        if (host) {
          if (solved.mspPairId === host.pairId && i === host.segIndex) continue
        } else if (isOwnNet && isPointOnSegment(anchor, pts[i]!, pts[i + 1]!)) {
          continue
        }
        const crossedLength = segmentLengthInsideBounds(
          pts[i]!,
          pts[i + 1]!,
          bounds,
        )
        penalty += crossedLength * TRACE_CROSSING_PENALTY
      }
    }
    return penalty
  }

  private beginSearchForLabel(label: NetLabelPlacement) {
    this.currentLabelToMove = label
    this.candidateQueue = this.buildCandidatesForLabel(label)
    this.candidateIndex = 0
    this.candidateResults = []
    this.currentLabelPenalty = this.computePlacementPenalty(
      label,
      this.labelBounds(label),
      label.anchorPoint,
    )
  }

  /**
   * No candidate resolved the collision outright. Instead of leaving the worst
   * overlap in place, apply the best strictly-improving candidate seen while
   * searching (if any), then mark the pair handled so it is never reprocessed.
   * Requiring strict improvement makes the total penalty monotonically
   * decrease, so fallback moves cannot cycle.
   */
  private applyFallbackBestOrSkip() {
    this.skippedCollisionKeys.add(
      this.collisionKey(this.currentCollision![0], this.currentCollision![1]),
    )
    if (this.fallbackBest) {
      const { label, candidate } = this.fallbackBest
      const idx = this.outputNetLabelPlacements.indexOf(label)
      if (idx !== -1) {
        this.outputNetLabelPlacements[idx] = {
          ...label,
          orientation: candidate.orientation,
          anchorPoint: candidate.anchor,
          width: candidate.width,
          height: candidate.height,
          center: candidate.center,
        }
      }
    }
    this.clearActiveSearch()
  }

  private clearActiveSearch() {
    this.currentCollision = null
    this.currentLabelToMove = null
    this.labelsToTry = []
    this.candidateQueue = []
    this.candidateIndex = 0
    this.candidateResults = []
    this.currentLabelPenalty = Infinity
    this.fallbackBest = null
  }

  override _step() {
    if (!this.currentCollision) {
      const pair = this.findNextCollidingPair()
      if (!pair) {
        this.solved = true
        return
      }
      this.currentCollision = pair
      this.labelsToTry = [pair[1], pair[0]]
      this.beginSearchForLabel(this.labelsToTry.shift()!)
      return
    }

    if (this.candidateIndex >= this.candidateQueue.length) {
      if (this.labelsToTry.length > 0) {
        this.beginSearchForLabel(this.labelsToTry.shift()!)
      } else {
        this.applyFallbackBestOrSkip()
      }
      return
    }

    const candidate = this.candidateQueue[this.candidateIndex++]!
    const [labelA, labelB] = this.currentCollision
    let fixedLabel: NetLabelPlacement
    if (this.currentLabelToMove === labelB) {
      fixedLabel = labelA
    } else {
      fixedLabel = labelB
    }
    const obstacleLabels = [
      ...this.outputNetLabelPlacements.filter(
        (l) => l !== labelA && l !== labelB,
      ),
      fixedLabel,
    ]

    const status = this.checkCandidate(
      candidate,
      this.currentLabelToMove!.globalConnNetId,
      obstacleLabels,
    )
    candidate.status = status
    this.candidateResults.push({ ...candidate })

    if (status !== "ok") {
      const penalty = this.computePlacementPenalty(
        this.currentLabelToMove!,
        candidate.bounds,
        candidate.anchor,
        candidate.hostPairId !== undefined &&
          candidate.hostSegIndex !== undefined
          ? {
              pairId: candidate.hostPairId,
              segIndex: candidate.hostSegIndex,
            }
          : undefined,
      )
      const improvement = this.currentLabelPenalty - penalty
      if (
        improvement > FALLBACK_MIN_IMPROVEMENT &&
        (!this.fallbackBest || improvement > this.fallbackBest.improvement)
      ) {
        this.fallbackBest = {
          label: this.currentLabelToMove!,
          candidate: { ...candidate },
          improvement,
        }
      }
    }

    if (status === "ok") {
      const idx = this.outputNetLabelPlacements.indexOf(
        this.currentLabelToMove!,
      )
      if (idx !== -1) {
        this.outputNetLabelPlacements[idx] = {
          ...this.currentLabelToMove!,
          orientation: candidate.orientation,
          anchorPoint: candidate.anchor,
          width: candidate.width,
          height: candidate.height,
          center: candidate.center,
        }
      }
      this.clearActiveSearch()
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.points) graphics.points = []

    for (const trace of this.traces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      } as any)
    }

    for (const label of this.outputNetLabelPlacements) {
      const isInActiveCollision =
        this.currentCollision != null &&
        (label === this.currentCollision[0] ||
          label === this.currentCollision[1])

      let labelFill: string
      let labelStroke: string
      let labelText: string
      let pointColor: string
      if (isInActiveCollision) {
        labelFill = "rgba(255, 0, 0, 0.2)"
        labelStroke = "red"
        labelText = `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}\n⚠ COLLIDING`
        pointColor = "red"
      } else {
        labelFill = getColorFromString(label.globalConnNetId, 0.35)
        labelStroke = getColorFromString(label.globalConnNetId, 0.9)
        labelText = `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`
        pointColor = getColorFromString(label.globalConnNetId, 0.9)
      }

      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: labelFill,
        strokeColor: labelStroke,
        label: labelText,
      } as any)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: pointColor,
        label: `anchorPoint\norientation: ${label.orientation}`,
      } as any)
    }

    const movingNetId = this.currentLabelToMove
      ? this.currentLabelToMove.netId
      : "?"
    for (const c of this.candidateResults) {
      const statusColor = CANDIDATE_STATUS_COLOR[c.status!]
      const statusFill = CANDIDATE_STATUS_FILL[c.status!]
      let strokeDash: string | undefined
      if (c.status !== "ok") strokeDash = "4 2"
      graphics.rects.push({
        center: c.center,
        width: c.width,
        height: c.height,
        fill: statusFill,
        strokeColor: statusColor,
        strokeDash,
        label: `candidate: ${c.status}\norientation: ${c.orientation}\nmoving: ${movingNetId}`,
      } as any)
      graphics.points.push({
        x: c.anchor.x,
        y: c.anchor.y,
        color: statusColor,
        label: `candidate anchor\n${c.status}`,
      } as any)
    }

    return graphics
  }
}
