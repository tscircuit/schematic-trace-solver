import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { ConnectivityMap } from "connectivity-map"
import type { Point } from "@tscircuit/math-utils"

const GAP_THRESHOLD = 0.05
const MIN_OVERLAP_RATIO = 0.5
const EPS = 1e-9

type ConnNetId = string

interface Segment {
  traceId: MspConnectionPairId
  segIndex: number
  p1: Point
  p2: Point
}

/**
 * Merges same-net trace segments that are parallel and close together.
 *
 * After routing, the MST may produce separate traces for the same net that run
 * nearly parallel with a small gap. This phase detects those near-parallel
 * segments and snaps them onto a shared coordinate, then simplifies the result.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  globalConnMap: ConnectivityMap

  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {}
  private traceNetIslands: Record<ConnNetId, SolvedTracePath[]> = {}
  private netIdsToProcess: ConnNetId[] = []

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    globalConnMap: ConnectivityMap
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.globalConnMap = params.globalConnMap

    for (const trace of this.inputTracePaths) {
      this.correctedTraceMap[trace.mspPairId] = {
        ...trace,
        tracePath: [...trace.tracePath],
      }
    }

    this.traceNetIslands = this.computeTraceNetIslands()
    this.netIdsToProcess = Object.keys(this.traceNetIslands).filter(
      (netId) => this.traceNetIslands[netId]!.length > 1,
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      globalConnMap: this.globalConnMap,
    }
  }

  private computeTraceNetIslands(): Record<ConnNetId, SolvedTracePath[]> {
    const islands: Record<ConnNetId, SolvedTracePath[]> = {}
    for (const trace of this.inputTracePaths) {
      const corrected = this.correctedTraceMap[trace.mspPairId]!
      const key = corrected.globalConnNetId
      if (!islands[key]) islands[key] = []
      islands[key].push(corrected)
    }
    return islands
  }

  override _step() {
    const netId = this.netIdsToProcess.pop()
    if (!netId) {
      this.solved = true
      return
    }

    const traces = this.traceNetIslands[netId]!
    this.mergeCloseSegmentsInNet(traces)
  }

  private mergeCloseSegmentsInNet(traces: SolvedTracePath[]) {
    // Collect all horizontal and vertical segments across traces in this net
    const hSegments: Segment[] = []
    const vSegments: Segment[] = []

    for (const trace of traces) {
      const path = trace.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]!
        const p2 = path[i + 1]!
        const seg: Segment = { traceId: trace.mspPairId, segIndex: i, p1, p2 }
        if (isHorizontal(p1, p2)) {
          hSegments.push(seg)
        } else if (isVertical(p1, p2)) {
          vSegments.push(seg)
        }
      }
    }

    // Merge close horizontal segments (same Y ± threshold, overlapping in X)
    this.mergeParallelSegments(hSegments, "horizontal")
    // Merge close vertical segments (same X ± threshold, overlapping in Y)
    this.mergeParallelSegments(vSegments, "vertical")
  }

  private mergeParallelSegments(
    segments: Segment[],
    direction: "horizontal" | "vertical",
  ) {
    const merged = new Set<string>() // "traceId:segIndex" keys already merged

    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      const keyA = `${a.traceId}:${a.segIndex}`
      if (merged.has(keyA)) continue

      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        const keyB = `${b.traceId}:${b.segIndex}`
        if (merged.has(keyB)) continue

        // Don't merge segments from the same trace
        if (a.traceId === b.traceId) continue

        if (this.shouldMerge(a, b, direction)) {
          this.applyMerge(a, b, direction)
          merged.add(keyB)
        }
      }
    }
  }

  private shouldMerge(
    a: Segment,
    b: Segment,
    direction: "horizontal" | "vertical",
  ): boolean {
    if (direction === "horizontal") {
      const yGap = Math.abs(a.p1.y - b.p1.y)
      if (yGap > GAP_THRESHOLD || yGap < EPS) return false
      return hasSignificantOverlap(a.p1.x, a.p2.x, b.p1.x, b.p2.x)
    }
    const xGap = Math.abs(a.p1.x - b.p1.x)
    if (xGap > GAP_THRESHOLD || xGap < EPS) return false
    return hasSignificantOverlap(a.p1.y, a.p2.y, b.p1.y, b.p2.y)
  }

  /**
   * Snap segment b's perpendicular coordinate to match segment a's.
   * This aligns the two segments onto the same line.
   */
  private applyMerge(
    a: Segment,
    b: Segment,
    direction: "horizontal" | "vertical",
  ) {
    const traceB = this.correctedTraceMap[b.traceId]!
    const path = traceB.tracePath

    // Compute target coordinate (median of the two)
    if (direction === "horizontal") {
      const targetY = (a.p1.y + b.p1.y) / 2
      // Snap both endpoints of segment b to the target Y
      path[b.segIndex]!.y = targetY
      path[b.segIndex + 1]!.y = targetY
      // Also snap segment a
      const traceA = this.correctedTraceMap[a.traceId]!
      traceA.tracePath[a.segIndex]!.y = targetY
      traceA.tracePath[a.segIndex + 1]!.y = targetY
    } else {
      const targetX = (a.p1.x + b.p1.x) / 2
      path[b.segIndex]!.x = targetX
      path[b.segIndex + 1]!.x = targetX
      const traceA = this.correctedTraceMap[a.traceId]!
      traceA.tracePath[a.segIndex]!.x = targetX
      traceA.tracePath[a.segIndex + 1]!.x = targetX
    }
  }
}

function isHorizontal(a: Point, b: Point): boolean {
  return Math.abs(a.y - b.y) < EPS
}

function isVertical(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < EPS
}

/**
 * Check if two 1D ranges overlap AND the overlapping portion is at least
 * MIN_OVERLAP_RATIO of the shorter segment. This prevents merging segments
 * that barely touch.
 */
function hasSignificantOverlap(
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean {
  const aMin = Math.min(a1, a2)
  const aMax = Math.max(a1, a2)
  const bMin = Math.min(b1, b2)
  const bMax = Math.max(b1, b2)

  const overlapStart = Math.max(aMin, bMin)
  const overlapEnd = Math.min(aMax, bMax)
  const overlapLen = overlapEnd - overlapStart

  if (overlapLen < EPS) return false

  const shorter = Math.min(aMax - aMin, bMax - bMin)
  if (shorter < EPS) return false

  return overlapLen / shorter >= MIN_OVERLAP_RATIO
}
