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

  private beginSearchForLabel(label: NetLabelPlacement) {
    this.currentLabelToMove = label
    this.candidateQueue = this.buildCandidatesForLabel(label)
    this.candidateIndex = 0
    this.candidateResults = []
  }

  private clearActiveSearch() {
    this.currentCollision = null
    this.currentLabelToMove = null
    this.labelsToTry = []
    this.candidateQueue = []
    this.candidateIndex = 0
    this.candidateResults = []
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
        this.skippedCollisionKeys.add(
          this.collisionKey(this.currentCollision[0], this.currentCollision[1]),
        )
        this.clearActiveSearch()
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
