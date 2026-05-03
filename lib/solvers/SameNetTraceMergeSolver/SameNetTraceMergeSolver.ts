import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { hasCollisions } from "lib/solvers/TraceCleanupSolver/hasCollisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

const EPS = 1e-6

/**
 * Represents a straight horizontal or vertical segment in a trace path.
 */
interface Segment {
  traceIndex: number
  pointIndex: number
  orientation: "horizontal" | "vertical"
  /** The invariant coordinate (Y for horizontal, X for vertical) */
  sharedCoord: number
  rangeMin: number
  rangeMax: number
}

/** Extract axis-aligned segments from a trace path */
function extractSegments(
  trace: SolvedTracePath,
  traceIndex: number,
): Segment[] {
  const segments: Segment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const dx = Math.abs(p2.x - p1.x)
    const dy = Math.abs(p2.y - p1.y)
    if (dy < EPS && dx > EPS) {
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "horizontal",
        sharedCoord: p1.y,
        rangeMin: Math.min(p1.x, p2.x),
        rangeMax: Math.max(p1.x, p2.x),
      })
    } else if (dx < EPS && dy > EPS) {
      segments.push({
        traceIndex,
        pointIndex: i,
        orientation: "vertical",
        sharedCoord: p1.x,
        rangeMin: Math.min(p1.y, p2.y),
        rangeMax: Math.max(p1.y, p2.y),
      })
    }
  }
  return segments
}

/** Check if two ranges overlap (with small epsilon) */
function rangesOverlap(
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean {
  return aMin < bMax - EPS && bMin < aMax - EPS
}

/**
 * SameNetTraceMergeSolver — a dedicated pipeline phase that snaps parallel
 * same-net trace segments that are close together onto the same axis coordinate,
 * making them visually indistinguishable (one wire instead of two).
 *
 * Addresses issues #29 and #34.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  /** Maximum distance between parallel same-net segments to merge them (in schematic units) */
  mergeThreshold: number

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
    mergeThreshold?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = [...params.traces]
    this.mergeThreshold = params.mergeThreshold ?? 0.4
  }

  override _step() {
    const updatedPaths = this.outputTraces.map((t) => [...t.tracePath])
    const chipObstacles = getObstacleRects(this.inputProblem)

    // Group trace indices by global net ID
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(i)
    }

    for (const [, traceIndices] of netGroups) {
      if (traceIndices.length < 2) continue

      // Collect all internal segments (skip first and last — they must connect to pins)
      const allSegments: Segment[] = []
      for (const ti of traceIndices) {
        const segs = extractSegments(this.outputTraces[ti]!, ti)
        // Skip endpoint segments to preserve pin connectivity
        for (const seg of segs) {
          const pathLen = this.outputTraces[ti]!.tracePath.length
          if (seg.pointIndex > 0 && seg.pointIndex < pathLen - 2) {
            allSegments.push(seg)
          }
        }
      }

      // Find pairs of parallel close segments and snap them together
      for (let a = 0; a < allSegments.length; a++) {
        for (let b = a + 1; b < allSegments.length; b++) {
          const segA = allSegments[a]!
          const segB = allSegments[b]!

          if (segA.traceIndex === segB.traceIndex) continue
          if (segA.orientation !== segB.orientation) continue

          const dist = Math.abs(segA.sharedCoord - segB.sharedCoord)
          if (dist < EPS || dist > this.mergeThreshold) continue

          if (
            !rangesOverlap(
              segA.rangeMin,
              segA.rangeMax,
              segB.rangeMin,
              segB.rangeMax,
            )
          )
            continue

          // Snap to the midpoint (average coordinate)
          const snapCoord = (segA.sharedCoord + segB.sharedCoord) / 2

          const pathA = updatedPaths[segA.traceIndex]!
          const pathB = updatedPaths[segB.traceIndex]!

          if (segA.orientation === "horizontal") {
            pathA[segA.pointIndex] = {
              x: pathA[segA.pointIndex]!.x,
              y: snapCoord,
            }
            pathA[segA.pointIndex + 1] = {
              x: pathA[segA.pointIndex + 1]!.x,
              y: snapCoord,
            }
            pathB[segB.pointIndex] = {
              x: pathB[segB.pointIndex]!.x,
              y: snapCoord,
            }
            pathB[segB.pointIndex + 1] = {
              x: pathB[segB.pointIndex + 1]!.x,
              y: snapCoord,
            }
          } else {
            pathA[segA.pointIndex] = {
              x: snapCoord,
              y: pathA[segA.pointIndex]!.y,
            }
            pathA[segA.pointIndex + 1] = {
              x: snapCoord,
              y: pathA[segA.pointIndex + 1]!.y,
            }
            pathB[segB.pointIndex] = {
              x: snapCoord,
              y: pathB[segB.pointIndex]!.y,
            }
            pathB[segB.pointIndex + 1] = {
              x: snapCoord,
              y: pathB[segB.pointIndex + 1]!.y,
            }
          }

          // Update segment coords for further comparisons this iteration
          segA.sharedCoord = snapCoord
          segB.sharedCoord = snapCoord
        }
      }
    }

    // Apply updated paths (revert any that now collide with chips)
    this.outputTraces = this.outputTraces.map((trace, i) => {
      const simplified = simplifyPath(updatedPaths[i]!)
      if (hasCollisions(simplified, chipObstacles)) {
        return trace
      }
      return { ...trace, tracePath: simplified }
    })

    this.solved = true
  }

  getOutput() {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = []
    for (const trace of this.outputTraces) {
      lines.push({
        points: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
        strokeColor: "blue",
      })
    }
    return { lines, points: [], rects: [], circles: [], texts: [] }
  }
}
