import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-3
const DEFAULT_CLOSE_THRESHOLD = 0.1

interface SameNetSegmentCombinerSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  closeDistanceThreshold?: number
}

/**
 * Combines same-net trace segments that are close together.
 *
 * When a net has multiple trace segments (e.g., from MSP routing of 3+ pin nets),
 * their endpoints may be very close or coincident. This solver merges those
 * into single combined traces, reducing visual clutter and redundant routing.
 */
export class SameNetSegmentCombinerSolver extends BaseSolver {
  private input: SameNetSegmentCombinerSolverInput
  private traces: SolvedTracePath[]
  private closeDistanceThreshold: number
  private netIds: string[] = []
  private currentNetIndex = 0

  constructor(input: SameNetSegmentCombinerSolverInput) {
    super()
    this.input = input
    this.traces = [...input.traces]
    this.closeDistanceThreshold =
      input.closeDistanceThreshold ?? DEFAULT_CLOSE_THRESHOLD
    this.MAX_ITERATIONS = 10000

    // Collect unique net IDs
    const netIdSet = new Set<string>()
    for (const trace of this.traces) {
      netIdSet.add(trace.globalConnNetId)
    }
    this.netIds = Array.from(netIdSet)
  }

  override _step() {
    if (this.currentNetIndex >= this.netIds.length) {
      this.solved = true
      return
    }

    const netId = this.netIds[this.currentNetIndex]!
    const netTraceIndices: number[] = []
    for (let i = 0; i < this.traces.length; i++) {
      if (this.traces[i]!.globalConnNetId === netId) {
        netTraceIndices.push(i)
      }
    }

    if (netTraceIndices.length < 2) {
      this.currentNetIndex++
      return
    }

    const merged = this.findAndMergeClosePairInPlace(netTraceIndices)

    if (!merged) {
      // No more merges possible for this net, move to next
      this.currentNetIndex++
    }
    // If merged, stay on same net to check for more merges
  }

  /**
   * Find two traces at the given indices that share a close endpoint and merge them.
   * Modifies this.traces in-place, preserving order for non-merged traces.
   * Returns true if a merge was performed.
   */
  private findAndMergeClosePairInPlace(indices: number[]): boolean {
    const threshold = this.closeDistanceThreshold

    for (let ii = 0; ii < indices.length; ii++) {
      for (let jj = ii + 1; jj < indices.length; jj++) {
        const idxA = indices[ii]!
        const idxB = indices[jj]!
        const traceA = this.traces[idxA]!
        const traceB = this.traces[idxB]!

        const pathA = traceA.tracePath
        const pathB = traceB.tracePath

        if (pathA.length < 2 || pathB.length < 2) continue

        const aStart = pathA[0]!
        const aEnd = pathA[pathA.length - 1]!
        const bStart = pathB[0]!
        const bEnd = pathB[pathB.length - 1]!

        let mergedPath: Point[] | null = null

        if (pointDist(aEnd, bStart) <= threshold) {
          mergedPath = [...pathA, ...pathB.slice(1)]
        } else if (pointDist(aStart, bEnd) <= threshold) {
          mergedPath = [...pathB, ...pathA.slice(1)]
        } else if (pointDist(aEnd, bEnd) <= threshold) {
          mergedPath = [...pathA, ...[...pathB].reverse().slice(1)]
        } else if (pointDist(aStart, bStart) <= threshold) {
          mergedPath = [...[...pathA].reverse(), ...pathB.slice(1)]
        }

        // Check endpoint-to-segment proximity
        if (!mergedPath) {
          mergedPath = tryEndpointToSegmentMerge(traceA, traceB, threshold)
        }

        if (!mergedPath) continue

        mergedPath = simplifyCollinearPoints(mergedPath)

        const merged: SolvedTracePath = {
          mspPairId: traceA.mspPairId + "+" + traceB.mspPairId,
          dcConnNetId: traceA.dcConnNetId,
          globalConnNetId: traceA.globalConnNetId,
          pins: dedupPins(traceA.pins, traceB.pins),
          tracePath: mergedPath,
          mspConnectionPairIds: [
            ...traceA.mspConnectionPairIds,
            ...traceB.mspConnectionPairIds,
          ],
          pinIds: [...new Set([...traceA.pinIds, ...traceB.pinIds])],
        }

        // Replace traceA with merged, remove traceB
        // Remove higher index first to keep lower index valid
        const hiIdx = Math.max(idxA, idxB)
        const loIdx = Math.min(idxA, idxB)
        this.traces.splice(hiIdx, 1)
        this.traces[loIdx] = merged

        return true
      }
    }

    return false
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.traces }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })
    if (!graphics.lines) graphics.lines = []

    for (const trace of this.traces) {
      graphics.lines!.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "green",
      })
    }

    return graphics
  }
}

function pointDist(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

/**
 * Try to merge when an endpoint of one trace is close to a segment
 * (not just an endpoint) of the other trace.
 */
function tryEndpointToSegmentMerge(
  traceA: SolvedTracePath,
  traceB: SolvedTracePath,
  threshold: number,
): Point[] | null {
  const pathA = traceA.tracePath
  const pathB = traceB.tracePath

  const aEnd = pathA[pathA.length - 1]!
  for (let si = 0; si < pathB.length - 1; si++) {
    const proj = projectOntoOrthogonalSegment(aEnd, pathB[si]!, pathB[si + 1]!)
    if (proj && pointDist(aEnd, proj) <= threshold) {
      return [...pathA, proj, ...pathB.slice(si + 1)]
    }
  }

  const aStart = pathA[0]!
  for (let si = 0; si < pathB.length - 1; si++) {
    const proj = projectOntoOrthogonalSegment(
      aStart,
      pathB[si]!,
      pathB[si + 1]!,
    )
    if (proj && pointDist(aStart, proj) <= threshold) {
      return [...pathB.slice(0, si + 1), proj, ...pathA]
    }
  }

  const bEnd = pathB[pathB.length - 1]!
  for (let si = 0; si < pathA.length - 1; si++) {
    const proj = projectOntoOrthogonalSegment(bEnd, pathA[si]!, pathA[si + 1]!)
    if (proj && pointDist(bEnd, proj) <= threshold) {
      return [...pathB, proj, ...pathA.slice(si + 1)]
    }
  }

  const bStart = pathB[0]!
  for (let si = 0; si < pathA.length - 1; si++) {
    const proj = projectOntoOrthogonalSegment(
      bStart,
      pathA[si]!,
      pathA[si + 1]!,
    )
    if (proj && pointDist(bStart, proj) <= threshold) {
      return [...pathA.slice(0, si + 1), proj, ...pathB]
    }
  }

  return null
}

function projectOntoOrthogonalSegment(
  point: Point,
  segStart: Point,
  segEnd: Point,
): Point | null {
  const isHorizontal = Math.abs(segStart.y - segEnd.y) < EPS
  const isVertical = Math.abs(segStart.x - segEnd.x) < EPS

  if (isHorizontal) {
    const minX = Math.min(segStart.x, segEnd.x)
    const maxX = Math.max(segStart.x, segEnd.x)
    if (point.x >= minX - EPS && point.x <= maxX + EPS) {
      return { x: Math.max(minX, Math.min(maxX, point.x)), y: segStart.y }
    }
  } else if (isVertical) {
    const minY = Math.min(segStart.y, segEnd.y)
    const maxY = Math.max(segStart.y, segEnd.y)
    if (point.y >= minY - EPS && point.y <= maxY + EPS) {
      return { x: segStart.x, y: Math.max(minY, Math.min(maxY, point.y)) }
    }
  }

  return null
}

function simplifyCollinearPoints(path: Point[]): Point[] {
  if (path.length <= 2) return path

  const result: Point[] = [path[0]!]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]!
    const curr = path[i]!
    const next = path[i + 1]!

    if (Math.abs(prev.x - curr.x) < EPS && Math.abs(prev.y - curr.y) < EPS) {
      continue
    }

    const isCollinearH =
      Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS
    const isCollinearV =
      Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS

    if (!isCollinearH && !isCollinearV) {
      result.push(curr)
    }
  }

  const lastPoint = path[path.length - 1]!
  const lastResult = result[result.length - 1]!
  if (
    Math.abs(lastResult.x - lastPoint.x) >= EPS ||
    Math.abs(lastResult.y - lastPoint.y) >= EPS
  ) {
    result.push(lastPoint)
  }

  return result
}

function dedupPins(
  pinsA: SolvedTracePath["pins"],
  pinsB: SolvedTracePath["pins"],
): SolvedTracePath["pins"] {
  const seen = new Set<string>()
  const result: any[] = []
  for (const pin of [...pinsA, ...pinsB]) {
    if (!seen.has(pin.pinId)) {
      seen.add(pin.pinId)
      result.push(pin)
    }
  }
  return result as SolvedTracePath["pins"]
}
