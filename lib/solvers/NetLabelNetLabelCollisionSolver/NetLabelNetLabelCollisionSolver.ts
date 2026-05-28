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
import { anchorsForSegment } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/anchors"
import { ChipObstacleSpatialIndex } from "lib/data-structures/ChipObstacleSpatialIndex"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"

const OUTWARD_OFFSET = 1e-4
const EPS = 1e-6

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

  private chipObstacleSpatialIndex: ChipObstacleSpatialIndex
  private inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  private recentlyFailed = new Set<string>()

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

  private detectCollisions(): Array<[NetLabelPlacement, NetLabelPlacement]> {
    const result: Array<[NetLabelPlacement, NetLabelPlacement]> = []
    const labels = this.outputNetLabelPlacements
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!
        const b = labels[j]!
        if (a.globalConnNetId === b.globalConnNetId) continue
        const key = this.collisionKey(a, b)
        if (this.recentlyFailed.has(key)) continue
        if (boundsOverlap(this.labelBounds(a), this.labelBounds(b))) {
          result.push([a, b])
        }
      }
    }
    return result
  }

  private getNetLabelWidth(label: NetLabelPlacement): number | undefined {
    if (label.orientation === "x+" || label.orientation === "x-") {
      return label.width
    }
    // y+/y- orientation: width and height are swapped, height holds netLabelWidth
    return label.height
  }

  private tryReposition(
    label: NetLabelPlacement,
    otherLabels: NetLabelPlacement[],
  ): NetLabelPlacement | null {
    const netLabelWidth = this.getNetLabelWidth(label)
    const isPortOnly = label.mspConnectionPairIds.length === 0

    const checkCandidate = (
      orientation: FacingDirection,
      anchor: { x: number; y: number },
      hostPairId?: MspConnectionPairId,
      hostSegIndex?: number,
    ): NetLabelPlacement | null => {
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
      const bounds = getRectBounds(center, width, height)

      if (this.chipObstacleSpatialIndex.getChipsInBounds(bounds).length > 0) {
        return null
      }

      if (
        rectIntersectsAnyTrace(bounds, this.inputTraceMap, hostPairId, hostSegIndex)
          .hasIntersection
      ) {
        return null
      }

      for (const other of otherLabels) {
        if (other.globalConnNetId === label.globalConnNetId) continue
        if (boundsOverlap(bounds, this.labelBounds(other))) return null
      }

      return { ...label, orientation, anchorPoint: anchor, width, height, center }
    }

    if (isPortOnly) {
      const anchor = label.anchorPoint
      // Try current orientation first, then others
      const orientations: FacingDirection[] = [
        label.orientation,
        ...([
          "x+", "x-", "y+", "y-",
        ] as FacingDirection[]).filter((o) => o !== label.orientation),
      ]
      for (const orientation of orientations) {
        const result = checkCandidate(orientation, anchor)
        if (result) return result
      }
      return null
    }

    // Trace-anchored: scan all segments of associated traces
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
        const anchors = anchorsForSegment(a, b)
        for (const anchor of anchors) {
          for (const orientation of segOrientations) {
            const result = checkCandidate(
              orientation,
              anchor,
              mspPairId as MspConnectionPairId,
              si,
            )
            if (result) return result
          }
        }
      }
    }

    return null
  }

  override _step() {
    const collisions = this.detectCollisions()

    if (collisions.length === 0) {
      this.solved = true
      return
    }

    const [labelA, labelB] = collisions[0]!
    const key = this.collisionKey(labelA, labelB)

    // Try moving B first (typically the colliding label added later), then A
    const otherLabels = this.outputNetLabelPlacements.filter(
      (l) => l !== labelA && l !== labelB,
    )

    for (const [toMove, fixed] of [
      [labelB, labelA],
      [labelA, labelB],
    ] as const) {
      const others = [...otherLabels, fixed]
      const newPlacement = this.tryReposition(toMove, others)
      if (newPlacement) {
        const idx = this.outputNetLabelPlacements.indexOf(toMove)
        if (idx !== -1) {
          this.outputNetLabelPlacements[idx] = newPlacement
        }
        return
      }
    }

    // Cannot fix this pair; skip it to avoid infinite loops
    this.recentlyFailed.add(key)
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

    for (const label of this.outputNetLabelPlacements) {
      graphics.rects.push({
        center: label.center,
        width: label.width,
        height: label.height,
        fill: getColorFromString(label.globalConnNetId, 0.35),
        strokeColor: getColorFromString(label.globalConnNetId, 0.9),
        label: `netId: ${label.netId}\nglobalConnNetId: ${label.globalConnNetId}`,
      } as any)
      graphics.points.push({
        x: label.anchorPoint.x,
        y: label.anchorPoint.y,
        color: getColorFromString(label.globalConnNetId, 0.9),
      } as any)
    }

    return graphics
  }
}
