import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Tolerance for treating two segments as collinear.
 * Two horizontal segments with |y1 - y2| <= this are on the same horizontal line.
 * Two vertical segments with |x1 - x2| <= this are on the same vertical line.
 */
const COLLINEAR_TOLERANCE = 0.01

/**
 * Maximum gap between two collinear same-net segments for them to be merged.
 * If end-to-end gap exceeds this value the segments are left untouched.
 */
const MERGE_GAP = 0.15

interface Point {
  x: number
  y: number
}

interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}

function getSegments(tracePath: Point[]): Segment[] {
  const segs: Segment[] = []
  for (let i = 0; i < tracePath.length - 1; i++) {
    segs.push({
      x1: tracePath[i].x,
      y1: tracePath[i].y,
      x2: tracePath[i + 1].x,
      y2: tracePath[i + 1].y,
    })
  }
  return segs
}

function isHorizontal(s: Segment): boolean {
  return Math.abs(s.y1 - s.y2) < COLLINEAR_TOLERANCE
}

function isVertical(s: Segment): boolean {
  return Math.abs(s.x1 - s.x2) < COLLINEAR_TOLERANCE
}

/**
 * Removes duplicate or near-duplicate collinear points from a trace path.
 * Points are considered duplicates if they are within COLLINEAR_TOLERANCE of each other.
 */
export function simplifyTracePath(path: Point[]): Point[] {
  if (path.length <= 1) return path
  const result: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = result[result.length - 1]
    const cur = path[i]
    const dist = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    if (dist > COLLINEAR_TOLERANCE) {
      result.push(cur)
    }
  }
  return result
}

/**
 * For a horizontal segment pair on the same y-axis:
 * returns the merged span [min, max] if they overlap or are within MERGE_GAP,
 * otherwise null.
 */
function tryMergeHorizontalSegments(
  s1: Segment,
  s2: Segment,
): { min: number; max: number; y: number } | null {
  if (!isHorizontal(s1) || !isHorizontal(s2)) return null
  if (Math.abs(s1.y1 - s2.y1) > COLLINEAR_TOLERANCE) return null

  const min1 = Math.min(s1.x1, s1.x2)
  const max1 = Math.max(s1.x1, s1.x2)
  const min2 = Math.min(s2.x1, s2.x2)
  const max2 = Math.max(s2.x1, s2.x2)

  // They can be merged if they overlap or the gap is small
  const gap = Math.max(0, Math.max(min1, min2) - Math.min(max1, max2))
  if (gap > MERGE_GAP) return null

  return {
    min: Math.min(min1, min2),
    max: Math.max(max1, max2),
    y: (s1.y1 + s2.y1) / 2,
  }
}

/**
 * For a vertical segment pair on the same x-axis:
 * returns the merged span [min, max] if they overlap or are within MERGE_GAP,
 * otherwise null.
 */
function tryMergeVerticalSegments(
  s1: Segment,
  s2: Segment,
): { min: number; max: number; x: number } | null {
  if (!isVertical(s1) || !isVertical(s2)) return null
  if (Math.abs(s1.x1 - s2.x1) > COLLINEAR_TOLERANCE) return null

  const min1 = Math.min(s1.y1, s1.y2)
  const max1 = Math.max(s1.y1, s1.y2)
  const min2 = Math.min(s2.y1, s2.y2)
  const max2 = Math.max(s2.y1, s2.y2)

  const gap = Math.max(0, Math.max(min1, min2) - Math.min(max1, max2))
  if (gap > MERGE_GAP) return null

  return {
    min: Math.min(min1, min2),
    max: Math.max(max1, max2),
    x: (s1.x1 + s2.x1) / 2,
  }
}

/**
 * Replace a segment in a trace path with a new one spanning [mergedMin, mergedMax].
 * The segment at `segIdx` is replaced in-place; any point at an endpoint that is
 * now interior to the merged segment is removed.
 */
function applyMergedHorizontalSegment(
  path: Point[],
  segIdx: number,
  merged: { min: number; max: number; y: number },
): Point[] {
  const result = [...path]
  // Update the two endpoints of this segment
  result[segIdx] = { x: merged.min, y: merged.y }
  result[segIdx + 1] = { x: merged.max, y: merged.y }
  return simplifyTracePath(result)
}

function applyMergedVerticalSegment(
  path: Point[],
  segIdx: number,
  merged: { min: number; max: number; x: number },
): Point[] {
  const result = [...path]
  result[segIdx] = { x: merged.x, y: merged.min }
  result[segIdx + 1] = { x: merged.x, y: merged.max }
  return simplifyTracePath(result)
}

export interface SameNetTraceCombiningSolverParams {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}

/**
 * Pipeline phase that merges same-net trace segments that lie on the same
 * horizontal or vertical line and are close together (within MERGE_GAP).
 *
 * This prevents visual duplication of wire segments when multiple MSP pairs
 * belonging to the same net are routed along nearly-identical paths.
 */
export class SameNetTraceCombiningSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]

  private _solved = false

  constructor({ inputProblem, traces }: SameNetTraceCombiningSolverParams) {
    super()
    this.inputProblem = inputProblem
    this.inputTraces = traces
    this.outputTraces = traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath.map((p) => ({ ...p }))],
    }))
  }

  override _step() {
    if (this._solved) {
      this.solved = true
      return
    }

    this._combineTraces()
    this._solved = true
    this.solved = true
  }

  private _combineTraces() {
    // Group traces by net
    const byNet = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i].globalConnNetId
      if (!byNet.has(netId)) byNet.set(netId, [])
      byNet.get(netId)!.push(i)
    }

    for (const [, idxs] of byNet) {
      if (idxs.length < 2) continue
      this._combineNetTraces(idxs)
    }
  }

  /**
   * For a group of traces on the same net, look for pairs of segments that
   * are collinear and close enough to merge. When found, extend one segment
   * to cover both and remove the now-redundant segment from the other trace.
   */
  private _combineNetTraces(traceIdxs: number[]) {
    let changed = true
    let maxPasses = 10 // Safety limit to avoid infinite loops

    while (changed && maxPasses-- > 0) {
      changed = false

      outer: for (let ai = 0; ai < traceIdxs.length; ai++) {
        for (let bi = ai + 1; bi < traceIdxs.length; bi++) {
          const aIdx = traceIdxs[ai]
          const bIdx = traceIdxs[bi]
          const traceA = this.outputTraces[aIdx]
          const traceB = this.outputTraces[bIdx]

          const segsA = getSegments(traceA.tracePath)
          const segsB = getSegments(traceB.tracePath)

          for (let ai2 = 0; ai2 < segsA.length; ai2++) {
            for (let bi2 = 0; bi2 < segsB.length; bi2++) {
              const sA = segsA[ai2]
              const sB = segsB[bi2]

              // Try horizontal merge
              const hMerge = tryMergeHorizontalSegments(sA, sB)
              if (hMerge) {
                this.outputTraces[aIdx] = {
                  ...traceA,
                  tracePath: applyMergedHorizontalSegment(
                    traceA.tracePath,
                    ai2,
                    hMerge,
                  ),
                }
                this.outputTraces[bIdx] = {
                  ...traceB,
                  tracePath: applyMergedHorizontalSegment(
                    traceB.tracePath,
                    bi2,
                    hMerge,
                  ),
                }
                changed = true
                break outer
              }

              // Try vertical merge
              const vMerge = tryMergeVerticalSegments(sA, sB)
              if (vMerge) {
                this.outputTraces[aIdx] = {
                  ...traceA,
                  tracePath: applyMergedVerticalSegment(
                    traceA.tracePath,
                    ai2,
                    vMerge,
                  ),
                }
                this.outputTraces[bIdx] = {
                  ...traceB,
                  tracePath: applyMergedVerticalSegment(
                    traceB.tracePath,
                    bi2,
                    vMerge,
                  ),
                }
                changed = true
                break outer
              }
            }
          }
        }
      }
    }
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.flatMap((t) => {
        const pts = t.tracePath.map((p) => `${p.x},${p.y}`).join(" ")
        return [
          {
            points: t.tracePath.map((p) => ({ x: p.x, y: p.y })),
            strokeColor: "blue",
            layer: "sameNetCombined",
          },
        ]
      }),
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
  }
}
