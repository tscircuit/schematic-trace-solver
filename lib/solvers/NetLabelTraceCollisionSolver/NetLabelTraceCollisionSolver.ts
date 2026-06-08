import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { getColorFromString } from "lib/utils/getColorFromString"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Merges all labels that touch/overlap with each other (transitively) around
 * a seed label into a single bounding-box label. This prevents the situation
 * where fixing one label collision re-routes the trace into an adjacent label.
 */
function buildMergedObstacleLabel(
  seedLabel: NetLabelPlacement,
  allLabels: NetLabelPlacement[],
): NetLabelPlacement {
  const TOUCH_MARGIN = 0.01

  const getBounds = (l: NetLabelPlacement) =>
    getRectBounds(l.center, l.width, l.height)

  const touches = (a: NetLabelPlacement, b: NetLabelPlacement) => {
    const ba = getBounds(a)
    const bb = getBounds(b)
    return (
      ba.minX <= bb.maxX + TOUCH_MARGIN &&
      ba.maxX >= bb.minX - TOUCH_MARGIN &&
      ba.minY <= bb.maxY + TOUCH_MARGIN &&
      ba.maxY >= bb.minY - TOUCH_MARGIN
    )
  }

  const group = new Set<NetLabelPlacement>([seedLabel])
  let changed = true
  while (changed) {
    changed = false
    for (const l of allLabels) {
      if (group.has(l)) continue
      if ([...group].some((g) => touches(g, l))) {
        group.add(l)
        changed = true
      }
    }
  }

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const l of group) {
    const b = getBounds(l)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const w = maxX - minX
  const h = maxY - minY

  return {
    ...seedLabel,
    center: { x: cx, y: cy },
    width: w,
    height: h,
  }
}

interface TraceInnerLabelOverlap {
  trace: SolvedTracePath
  label: NetLabelPlacement
}

/**
 * Detects overlaps where a trace's INTERIOR (non-endpoint) segments cross a label.
 * Traces are allowed to boundary a label at their endpoints (pin locations),
 * just not allowed to cross through it in the middle.
 */
function detectInnerTraceLabelOverlaps(
  traces: SolvedTracePath[],
  labels: NetLabelPlacement[],
): TraceInnerLabelOverlap[] {
  const overlaps: TraceInnerLabelOverlap[] = []
  for (const trace of traces) {
    for (const label of labels) {
      if (trace.globalConnNetId === label.globalConnNetId) continue
      const bounds = getRectBounds(label.center, label.width, label.height)
      const path = trace.tracePath
      // Skip first and last segments — trace endpoints (pins) may legitimately
      // sit inside or adjacent to labels of neighbouring nets.
      const innerStart = 1
      const innerEnd = path.length - 2
      for (let i = innerStart; i < innerEnd; i++) {
        if (segmentIntersectsRect(path[i]!, path[i + 1]!, bounds)) {
          overlaps.push({ trace, label })
          break
        }
      }
    }
  }
  return overlaps
}

export interface NetLabelTraceCollisionSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
}

const PADDING_BUFFER = 0.1
const MAX_DETOUR_ATTEMPTS = 3

export class NetLabelTraceCollisionSolver extends BaseSolver {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]

  outputTraces: SolvedTracePath[]
  outputNetLabelPlacements: NetLabelPlacement[]

  override activeSubSolver: SingleOverlapSolver | null = null
  private recentlyFailed = new Set<string>()
  private detourCounts = new Map<string, number>()

  private currentOverlap: {
    trace: SolvedTracePath
    label: NetLabelPlacement
  } | null = null

  constructor(params: NetLabelTraceCollisionSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces
    this.netLabelPlacements = params.netLabelPlacements
    this.outputTraces = [...params.traces]
    this.outputNetLabelPlacements = [...params.netLabelPlacements]
  }

  override getConstructorParams(): ConstructorParameters<
    typeof NetLabelTraceCollisionSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  override _step() {
    if (this.activeSubSolver) {
      this.activeSubSolver.step()

      if (this.activeSubSolver.solved) {
        const solvedPath = this.activeSubSolver.solvedTracePath
        if (solvedPath) {
          const idx = this.outputTraces.findIndex(
            (t) => t.mspPairId === this.activeSubSolver!.initialTrace.mspPairId,
          )
          if (idx !== -1) {
            this.outputTraces[idx] = {
              ...this.outputTraces[idx],
              tracePath: solvedPath,
            }
          }
        }
        this.activeSubSolver = null
        this.currentOverlap = null
      } else if (this.activeSubSolver.failed) {
        const key = this.getOverlapKey(
          this.activeSubSolver.initialTrace,
          this.activeSubSolver.label,
        )
        this.recentlyFailed.add(key)
        this.activeSubSolver = null
        this.currentOverlap = null
      }
      return
    }

    const overlaps = detectInnerTraceLabelOverlaps(
      this.outputTraces,
      this.outputNetLabelPlacements,
    )

    const actionable = overlaps.filter((o) => {
      const key = this.getOverlapKey(o.trace, o.label)
      return !this.recentlyFailed.has(key)
    })

    if (actionable.length === 0) {
      this.solved = true
      return
    }

    const next = actionable[0]

    const traceToFix = this.outputTraces.find(
      (t) => t.mspPairId === next.trace.mspPairId,
    )!

    this.currentOverlap = next

    // Merge all touching/overlapping labels into one obstacle so that fixing
    // one collision doesn't immediately create another with an adjacent label.
    const mergedLabel = buildMergedObstacleLabel(
      next.label,
      this.outputNetLabelPlacements.filter(
        (l) => l.globalConnNetId !== traceToFix.globalConnNetId,
      ),
    )

    const mergeKey = `${next.trace.mspPairId}::merged::${mergedLabel.center.x},${mergedLabel.center.y},${mergedLabel.width},${mergedLabel.height}`
    const detourCount = this.detourCounts.get(mergeKey) ?? 0
    if (detourCount >= MAX_DETOUR_ATTEMPTS) {
      this.recentlyFailed.add(this.getOverlapKey(next.trace, next.label))
      this.currentOverlap = null
      return
    }
    this.detourCounts.set(mergeKey, detourCount + 1)

    this.activeSubSolver = new SingleOverlapSolver({
      trace: traceToFix,
      label: mergedLabel,
      problem: this.inputProblem,
      paddingBuffer: PADDING_BUFFER,
      detourCount,
    })
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      netLabelPlacements: this.outputNetLabelPlacements,
    }
  }

  private getOverlapKey(trace: SolvedTracePath, label: NetLabelPlacement) {
    return `${trace.mspPairId}::${label.globalConnNetId}`
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) return this.activeSubSolver.visualize()

    const graphics = visualizeInputProblem(this.inputProblem)
    if (!graphics.lines) graphics.lines = []
    if (!graphics.rects) graphics.rects = []
    if (!graphics.points) graphics.points = []

    for (const trace of this.outputTraces) {
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

    if (this.currentOverlap) {
      graphics.lines.push({
        points: this.currentOverlap.trace.tracePath,
        strokeColor: "red",
      } as any)
      graphics.rects.push({
        center: this.currentOverlap.label.center,
        width: this.currentOverlap.label.width,
        height: this.currentOverlap.label.height,
        fill: "rgba(255,0,0,0.3)",
        strokeColor: "red",
      } as any)
    }

    return graphics
  }
}


---

import * as graphicsDebug from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { SingleOverlapSolver } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/SingleOverlapSolver/SingleOverlapSolver"
import { getColorFromString } from "lib/utils/getColorFromString"

function buildMergedObstacleLabel(
  label: string | undefined,
  netIds: number[] = [],
): NetLabelPlacement {
  const rectBounds = getRectBounds(label, netIds)
  if (!rectBounds) return null

  const overlap = segmentIntersectsRect(rectBounds, netIds)
  if (overlap) {
    // If there's a collision, we need to build the merged label
    let newBound: Bounds = {
      minX: rectBounds.minX,
      minY: rectBounds.minY,
      maxX: rectBounds.maxX,
      maxY: rectBounds.maxY,
    }
    const