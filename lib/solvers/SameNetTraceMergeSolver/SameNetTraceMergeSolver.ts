/**
 * SameNetTraceMergeSolver
 *
 * A pipeline phase that merges same-net trace segments that are close together
 * along the same axis (horizontal segments at nearly the same Y, or vertical
 * segments at nearly the same X). This eliminates redundant parallel wires that
 * are electrically identical, producing a cleaner schematic.
 *
 * Implements: https://github.com/tscircuit/schematic-trace-solver/issues/34
 */

import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"

/** Segments closer than this (in schematic units) on the same axis get merged */
const GAP_THRESHOLD = 0.19

/** Floating-point tolerance for axis-alignment checks */
const AXIS_TOL = 1e-9

type Segment = {
  traceIdx: number
  segIdx: number // index of first point of segment in tracePath
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface SameNetTraceMergeSolverInput {
  allTraces: SolvedTracePath[]
}

/**
 * Simplify a path by removing collinear intermediate points and zero-length
 * segments while preserving the first and last points.
 */
function simplifyPath(
  path: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  if (path.length < 3) return path

  const result: Array<{ x: number; y: number }> = [path[0]!]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]!
    const curr = path[i]!
    const next = path[i + 1]!

    // Skip zero-length segments
    if (
      Math.abs(prev.x - curr.x) < AXIS_TOL &&
      Math.abs(prev.y - curr.y) < AXIS_TOL
    ) {
      continue
    }

    // Skip collinear points (both horizontal or both vertical)
    const prevCurrHoriz = Math.abs(prev.y - curr.y) < AXIS_TOL
    const currNextHoriz = Math.abs(curr.y - next.y) < AXIS_TOL
    const prevCurrVert = Math.abs(prev.x - curr.x) < AXIS_TOL
    const currNextVert = Math.abs(curr.x - next.x) < AXIS_TOL

    if ((prevCurrHoriz && currNextHoriz) || (prevCurrVert && currNextVert)) {
      continue
    }

    result.push(curr)
  }

  const last = path[path.length - 1]!
  const secondLast = result[result.length - 1]!

  // Only push the last point if it's not identical to the current last
  if (
    Math.abs(secondLast.x - last.x) > AXIS_TOL ||
    Math.abs(secondLast.y - last.y) > AXIS_TOL
  ) {
    result.push(last)
  }

  return result
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.inputTraces = input.allTraces
    // Deep-clone paths so we don't mutate the upstream solver's data
    this.outputTraces = input.allTraces.map((t) => ({
      ...t,
      tracePath: t.tracePath.map((p) => ({ ...p })),
    }))
  }

  override _step() {
    // Group trace indices by globalConnNetId
    const netGroups = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!netGroups.has(netId)) netGroups.set(netId, [])
      netGroups.get(netId)!.push(i)
    }

    for (const traceIndices of netGroups.values()) {
      if (traceIndices.length < 2) continue
      this._mergeTracesInGroup(traceIndices)
    }

    // Simplify all paths after merging
    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    this.solved = true
  }

  private _mergeTracesInGroup(traceIndices: number[]) {
    // Collect all segments across all traces in this net group
    const allSegments: Segment[] = []
    for (const traceIdx of traceIndices) {
      const path = this.outputTraces[traceIdx]!.tracePath
      for (let si = 0; si < path.length - 1; si++) {
        allSegments.push({
          traceIdx,
          segIdx: si,
          x1: path[si]!.x,
          y1: path[si]!.y,
          x2: path[si + 1]!.x,
          y2: path[si + 1]!.y,
        })
      }
    }

    // Check every pair of segments from different traces
    for (let i = 0; i < allSegments.length; i++) {
      for (let j = i + 1; j < allSegments.length; j++) {
        const a = allSegments[i]!
        const b = allSegments[j]!

        // Only consider cross-trace pairs
        if (a.traceIdx === b.traceIdx) continue

        const aHoriz =
          Math.abs(a.y1 - a.y2) < AXIS_TOL && Math.abs(a.x1 - a.x2) > AXIS_TOL
        const bHoriz =
          Math.abs(b.y1 - b.y2) < AXIS_TOL && Math.abs(b.x1 - b.x2) > AXIS_TOL
        const aVert =
          Math.abs(a.x1 - a.x2) < AXIS_TOL && Math.abs(a.y1 - a.y2) > AXIS_TOL
        const bVert =
          Math.abs(b.x1 - b.x2) < AXIS_TOL && Math.abs(b.y1 - b.y2) > AXIS_TOL

        if (aHoriz && bHoriz) {
          this._tryMergeHorizontal(a, b)
        } else if (aVert && bVert) {
          this._tryMergeVertical(a, b)
        }
      }
    }
  }

  /**
   * If two horizontal segments on the same net are close in Y and overlap in X,
   * snap segment b's Y to segment a's Y.
   */
  private _tryMergeHorizontal(a: Segment, b: Segment) {
    const yDiff = Math.abs(a.y1 - b.y1)
    if (yDiff < AXIS_TOL || yDiff > GAP_THRESHOLD) return

    // Check that their X ranges overlap
    const aXMin = Math.min(a.x1, a.x2)
    const aXMax = Math.max(a.x1, a.x2)
    const bXMin = Math.min(b.x1, b.x2)
    const bXMax = Math.max(b.x1, b.x2)

    const overlapStart = Math.max(aXMin, bXMin)
    const overlapEnd = Math.min(aXMax, bXMax)
    if (overlapEnd <= overlapStart) return

    // Snap b's segment to a's Y coordinate
    const targetY = a.y1
    const path = this.outputTraces[b.traceIdx]!.tracePath
    path[b.segIdx]!.y = targetY
    path[b.segIdx + 1]!.y = targetY

    // Update our in-loop segment metadata so later iterations use the new coords
    b.y1 = targetY
    b.y2 = targetY
  }

  /**
   * If two vertical segments on the same net are close in X and overlap in Y,
   * snap segment b's X to segment a's X.
   */
  private _tryMergeVertical(a: Segment, b: Segment) {
    const xDiff = Math.abs(a.x1 - b.x1)
    if (xDiff < AXIS_TOL || xDiff > GAP_THRESHOLD) return

    // Check that their Y ranges overlap
    const aYMin = Math.min(a.y1, a.y2)
    const aYMax = Math.max(a.y1, a.y2)
    const bYMin = Math.min(b.y1, b.y2)
    const bYMax = Math.max(b.y1, b.y2)

    const overlapStart = Math.max(aYMin, bYMin)
    const overlapEnd = Math.min(aYMax, bYMax)
    if (overlapEnd <= overlapStart) return

    // Snap b's segment to a's X coordinate
    const targetX = a.x1
    const path = this.outputTraces[b.traceIdx]!.tracePath
    path[b.segIdx]!.x = targetX
    path[b.segIdx + 1]!.x = targetX

    b.x1 = targetX
    b.x2 = targetX
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.flatMap((trace) => {
        const segs = []
        for (let i = 0; i < trace.tracePath.length - 1; i++) {
          segs.push({
            x1: trace.tracePath[i]!.x,
            y1: trace.tracePath[i]!.y,
            x2: trace.tracePath[i + 1]!.x,
            y2: trace.tracePath[i + 1]!.y,
            strokeColor: "blue",
            points: [],
          })
        }
        return segs
      }),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
