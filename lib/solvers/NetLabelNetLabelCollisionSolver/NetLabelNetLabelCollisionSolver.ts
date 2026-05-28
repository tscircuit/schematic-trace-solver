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

const OUTWARD_OFFSET = 1e-4
const EPS = 1e-6
const CANDIDATE_STEP = 0.1

function anchorsAlongSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.max(1, Math.round(len / CANDIDATE_STEP))
  const result: Array<{ x: number; y: number }> = []
  for (let k = 0; k <= steps; k++) {
    const t = k / steps
    result.push({ x: a.x + t * dx, y: a.y + t * dy })
  }
  return result
}

function boundsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
  eps = 1e-9,
): boolean {
  return (
    a.minX < b.maxX - eps &&
    a.maxX > b.minX + eps &&
    a.minY < b.maxY - eps &&
    a.maxY > b.minY + eps
  )
}

type CandidateStatus = "ok" | "chip-collision" | "trace-collision" | "label-collision"

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

  // Active state (for visualization)
  currentCollision: [NetLabelPlacement, NetLabelPlacement] | null = null
  currentLabelToMove: NetLabelPlacement | null = null
  candidateResults: Candidate[] = []

  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  private recentlyFailed = new Set<string>()

  private candidateQueue: Candidate[] = []
  private candidateIndex = 0
  // 0 = trying second label of pair, 1 = trying first label of pair
  private attemptPhase = 0

  constructor(params: NetLabelNetLabelCollisionSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
    this.chipObstacleSpatialIndex =
      params.inputProblem._chipObstacleSpatialIndex ??
      new ChipObstacleSpatialIndex(params.inputProblem.chips)
    this.inputTraceMap = Object.fromEntries(
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

  private labelBounds(label: NetLabelPlacement) {
    return getRectBounds(label.center, label.width, label.height)
  }

  private collisionKey(a: NetLabelPlacement, b: NetLabelPlacement) {
    const ids = [a.globalConnNetId, b.globalConnNetId].sort()
    return ids.join("::")
  }

  private detectNextCollision(): [NetLabelPlacement, NetLabelPlacement] | null {
    const labels = this.outputNetLabelPlacements
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!
        const b = labels[j]!
        if (a.globalConnNetId === b.globalConnNetId) continue
        if (this.recentlyFailed.has(this.collisionKey(a, b))) continue
        if (boundsOverlap(this.labelBounds(a), this.labelBounds(b))) {
          return [a, b]
        }
      }
    }
    return null
  }

  private getNetLabelWidth(label: NetLabelPlacement): number | undefined {
    // x+/x-: width is the netLabelWidth; y+/y-: swapped, height holds netLabelWidth
    if (label.orientation === "x+" || label.orientation === "x-") {
      return label.width
    }
    return label.height
  }

  private buildCandidates(label: NetLabelPlacement): Candidate[] {
    const netLabelWidth = this.getNetLabelWidth(label)
    const candidates: Candidate[] = []
    const isPortOnly = label.mspConnectionPairIds.length === 0

    const makeCandidate = (
      orientation: FacingDirection,
      anchor: { x: number; y: number },
      hostPairId?: MspConnectionPairId,
      hostSegIndex?: number,
    ): Candidate => {
      const { width, height } = getDimsForOrientation({ orientation, netLabelWidth })
      const baseCenter = getCenterFromAnchor(anchor, orientation, width, height)
      const outward =
        orientation === "x+" ? { x: 1, y: 0 } :
        orientation === "x-" ? { x: -1, y: 0 } :
        orientation === "y+" ? { x: 0, y: 1 } : { x: 0, y: -1 }
      const center = {
        x: baseCenter.x + outward.x * OUTWARD_OFFSET,
        y: baseCenter.y + outward.y * OUTWARD_OFFSET,
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

    if (isPortOnly) {
      const anchor = label.anchorPoint
      const orientations: FacingDirection[] = [
        label.orientation,
        ...([
          "x+", "x-", "y+", "y-",
        ] as FacingDirection[]).filter((o) => o !== label.orientation),
      ]
      for (const orientation of orientations) {
        candidates.push(makeCandidate(orientation, anchor))
      }
    } else {
      for (const mspPairId of label.mspConnectionPairIds) {
        const trace = this.inputTraceMap[mspPairId]
        if (!trace) continue
        const pts = trace.tracePath
        for (let si = 0; si < pts.length - 1; si++) {
          const a = pts[si]!
          const b = pts[si + 1]!
          const isH = Math.abs(a.y - b.y) < EPS
          const isV = Math.abs(a.x - b.x) < EPS
          if (!isH && !isV) continue
          const segOrientations: FacingDirection[] = isH ? ["y+", "y-"] : ["x+", "x-"]
          for (const anchor of anchorsAlongSegment(a, b)) {
            for (const orientation of segOrientations) {
              candidates.push(
                makeCandidate(
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

  private evaluateCandidate(
    candidate: Candidate,
    labelToMove: NetLabelPlacement,
    otherLabels: NetLabelPlacement[],
  ): CandidateStatus {
    const { bounds, hostPairId, hostSegIndex } = candidate

    if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
      return "chip-collision"
    }

    if (
      rectIntersectsAnyTrace(bounds, this.inputTraceMap, hostPairId, hostSegIndex)
        .hasIntersection
    ) {
      return "trace-collision"
    }

    for (const other of otherLabels) {
      if (other.globalConnNetId === labelToMove.globalConnNetId) continue
      if (boundsOverlap(bounds, this.labelBounds(other))) return "label-collision"
    }

    return "ok"
  }

  private startCollisionSearch(pair: [NetLabelPlacement, NetLabelPlacement]) {
    this.currentCollision = pair
    this.attemptPhase = 0
    this.candidateResults = []
    this.currentLabelToMove = pair[1] // try second label first
    this.candidateQueue = this.buildCandidates(pair[1])
    this.candidateIndex = 0
  }

  private switchToOtherLabel() {
    if (!this.currentCollision) return
    this.attemptPhase = 1
    this.candidateResults = []
    this.currentLabelToMove = this.currentCollision[0]
    this.candidateQueue = this.buildCandidates(this.currentCollision[0])
    this.candidateIndex = 0
  }

  private clearSearch() {
    this.currentCollision = null
    this.currentLabelToMove = null
    this.candidateQueue = []
    this.candidateIndex = 0
    this.candidateResults = []
    this.attemptPhase = 0
  }

  override _step() {
    // No active search: find next collision
    if (!this.currentCollision) {
      const pair = this.detectNextCollision()
      if (!pair) {
        this.solved = true
        return
      }
      this.startCollisionSearch(pair)
      return
    }

    // Exhausted candidates for current label
    if (this.candidateIndex >= this.candidateQueue.length) {
      if (this.attemptPhase === 0) {
        // Try the other label of the pair
        this.switchToOtherLabel()
        return
      }
      // Both labels exhausted: give up on this collision
      this.recentlyFailed.add(
        this.collisionKey(this.currentCollision[0], this.currentCollision[1]),
      )
      this.clearSearch()
      return
    }

    // Evaluate next candidate
    const candidate = this.candidateQueue[this.candidateIndex]!
    this.candidateIndex++

    const [labelA, labelB] = this.currentCollision
    const toMove = this.currentLabelToMove!
    const fixed = toMove === labelB ? labelA : labelB
    const otherLabels = this.outputNetLabelPlacements.filter(
      (l) => l !== labelA && l !== labelB,
    )

    const status = this.evaluateCandidate(candidate, toMove, [...otherLabels, fixed])
    candidate.status = status
    this.candidateResults.push({ ...candidate })

    if (status === "ok") {
      // Apply the placement
      const idx = this.outputNetLabelPlacements.indexOf(toMove)
      if (idx !== -1) {
        this.outputNetLabelPlacements[idx] = {
          ...toMove,
          orientation: candidate.orientation,
          anchorPoint: candidate.anchor,
          width: candidate.width,
          height: candidate.height,
          center: candidate.center,
        }
      }
      this.clearSearch()
    }
  }

  getOutput() {
    return {
      netLabelPlacements: this.outputNetLabelPlacements,
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

    // All current labels
    for (const label of this.outputNetLabelPlacements) {
      const isColliding =
        this.currentCollision != null &&
        (label === this.currentCollision[0] || label === this.currentCollision[1])

      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: isColliding
          ? "rgba(255, 0, 0, 0.2)"
          : getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: isColliding
          ? "red"
          : getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}${isColliding ? "\n⚠ COLLIDING" : ""}`,
      } as any)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: isColliding ? "red" : getColorFromString(label.globalConnNetId, 0.9),
        label: `anchorPoint\norientation: ${label.orientation}`,
      } as any)
    }

    // Tested candidates for current search
    for (const c of this.candidateResults) {
      const color =
        c.status === "ok"
          ? "green"
          : c.status === "label-collision"
            ? "orange"
            : c.status === "trace-collision"
              ? "darkorange"
              : "red"
      const fill =
        c.status === "ok"
          ? "rgba(0, 200, 0, 0.25)"
          : c.status === "label-collision"
            ? "rgba(255, 160, 0, 0.2)"
            : c.status === "trace-collision"
              ? "rgba(200, 80, 0, 0.2)"
              : "rgba(220, 0, 0, 0.15)"

      graphics.rects.push({
        center: c.center,
        width: c.width,
        height: c.height,
        fill,
        strokeColor: color,
        strokeDash: c.status === "ok" ? undefined : "4 2",
        label: `candidate: ${c.status}\norientation: ${c.orientation}\nmoving: ${this.currentLabelToMove?.netId ?? "?"}`,
      } as any)
      graphics.points.push({
        x: c.anchor.x,
        y: c.anchor.y,
        color,
        label: `candidate anchor\n${c.status}`,
      } as any)
    }

    return graphics
  }
}
