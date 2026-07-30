import type { GraphicsObject } from "graphics-debug"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
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
import type { FacingDirection } from "lib/utils/dir"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getOrientationConstraint } from "lib/utils/getOrientationConstraint"
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
/**
 * Max number of steps a port-only label anchor is allowed to slide outward
 * from its pin when escaping a chip body (see #655). Port-only labels are
 * anchored directly on a pin — when that pin is covered by another chip's
 * body every orientation collides, so we progressively nudge the anchor
 * outward until the label escapes the chip.
 */
const MAX_PORT_ONLY_ESCAPE_STEPS = 30
/**
 * Fraction of a net label's area that must be covered by a chip body before
 * the label is considered "inside" the chip and relocated (see #655). Small
 * incidental overlaps are tolerated — they're handled by other solvers and
 * relocating them can violate orientation preferences.
 */
const CHIP_COLLISION_MIN_OVERLAP_FRACTION = 0.5

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
  currentChipCollisionLabel: NetLabelPlacement | null = null
  currentLabelToMove: NetLabelPlacement | null = null
  candidateResults: Candidate[] = []

  private chipIndex: ChipObstacleSpatialIndex
  private traceMap: Record<MspConnectionPairId, SolvedTracePath>
  private skippedCollisionKeys = new Set<string>()
  private skippedChipCollisionNetIds = new Set<string>()

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

  private findNextChipCollidingLabel(): NetLabelPlacement | null {
    for (const label of this.outputNetLabelPlacements) {
      if (this.skippedChipCollisionNetIds.has(label.globalConnNetId)) continue
      const bounds = this.labelBounds(label)
      const labelArea = label.width * label.height
      if (labelArea <= 0) continue
      const chips = this.chipIndex.getChipsInBounds(bounds)
      for (const chip of chips) {
        const chipBounds = getRectBounds(chip.center, chip.width, chip.height)
        const overlapX =
          Math.min(bounds.maxX, chipBounds.maxX) -
          Math.max(bounds.minX, chipBounds.minX)
        const overlapY =
          Math.min(bounds.maxY, chipBounds.maxY) -
          Math.max(bounds.minY, chipBounds.minY)
        if (overlapX <= 0 || overlapY <= 0) continue
        if (
          overlapX * overlapY >=
          labelArea * CHIP_COLLISION_MIN_OVERLAP_FRACTION
        ) {
          return label
        }
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
      const orientationConstraint = getOrientationConstraint(
        this.inputProblem,
        label,
      )
      const allowedOrientations =
        orientationConstraint && orientationConstraint.length > 0
          ? allOrientations.filter((o) => orientationConstraint.includes(o))
          : allOrientations
      const orderedOrientations = allowedOrientations.includes(
        label.orientation,
      )
        ? [
            label.orientation,
            ...allowedOrientations.filter((o) => o !== label.orientation),
          ]
        : allowedOrientations
      // Try anchors progressively farther from the pin: when the pin is
      // covered by a chip body every candidate at distance 0 collides, so
      // sliding the anchor outward lets the label escape the chip (#655).
      for (let step = 0; step <= MAX_PORT_ONLY_ESCAPE_STEPS; step++) {
        for (const orientation of orderedOrientations) {
          const outward = OUTWARD_DIR[orientation]
          const anchor = {
            x: label.anchorPoint.x + outward.x * step * CANDIDATE_STEP,
            y: label.anchorPoint.y + outward.y * step * CANDIDATE_STEP,
          }
          candidates.push(buildCandidate(orientation, anchor))
        }
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
    this.currentChipCollisionLabel = null
    this.currentLabelToMove = null
    this.labelsToTry = []
    this.candidateQueue = []
    this.candidateIndex = 0
    this.candidateResults = []
  }

  override _step() {
    if (!this.currentCollision && !this.currentChipCollisionLabel) {
      const pair = this.findNextCollidingPair()
      if (pair) {
        this.currentCollision = pair
        this.labelsToTry = [pair[1], pair[0]]
        this.beginSearchForLabel(this.labelsToTry.shift()!)
        return
      }
      // No label-label collisions left, relocate labels that sit inside
      // chip bodies (they would render behind the component)
      const chipCollidingLabel = this.findNextChipCollidingLabel()
      if (!chipCollidingLabel) {
        this.solved = true
        return
      }
      this.currentChipCollisionLabel = chipCollidingLabel
      this.beginSearchForLabel(chipCollidingLabel)
      return
    }

    if (this.candidateIndex >= this.candidateQueue.length) {
      if (this.labelsToTry.length > 0) {
        this.beginSearchForLabel(this.labelsToTry.shift()!)
      } else if (this.currentCollision) {
        this.skippedCollisionKeys.add(
          this.collisionKey(this.currentCollision[0], this.currentCollision[1]),
        )
        this.clearActiveSearch()
      } else {
        this.skippedChipCollisionNetIds.add(
          this.currentChipCollisionLabel!.globalConnNetId,
        )
        this.clearActiveSearch()
      }
      return
    }

    const candidate = this.candidateQueue[this.candidateIndex++]!
    let obstacleLabels: NetLabelPlacement[]
    if (this.currentCollision) {
      const [labelA, labelB] = this.currentCollision
      let fixedLabel: NetLabelPlacement
      if (this.currentLabelToMove === labelB) {
        fixedLabel = labelA
      } else {
        fixedLabel = labelB
      }
      obstacleLabels = [
        ...this.outputNetLabelPlacements.filter(
          (l) => l !== labelA && l !== labelB,
        ),
        fixedLabel,
      ]
    } else {
      obstacleLabels = this.outputNetLabelPlacements.filter(
        (l) => l !== this.currentLabelToMove,
      )
    }

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
        (this.currentCollision != null &&
          (label === this.currentCollision[0] ||
            label === this.currentCollision[1])) ||
        label === this.currentChipCollisionLabel

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
