import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const MERGE_THRESHOLD = 0.05 // units — segments closer than this on the same axis are merged

interface SameNetTraceMergeSolverInput {
  inputProblem: InputProblem
  allTraces: SolvedTracePath[]
}

interface Segment {
  traceIndex: number
  segIndex: number // index of p1 in tracePath
  p1: Point
  p2: Point
  axis: "x" | "y"
  fixedCoord: number // x for vertical seg, y for horizontal seg
  min: number
  max: number
  netId: string
}

function segmentsFromTrace(
  trace: SolvedTracePath,
  traceIndex: number,
  netId: string,
): Segment[] {
  const segs: Segment[] = []
  const path = trace.tracePath
  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const dx = Math.abs(p2.x - p1.x)
    const dy = Math.abs(p2.y - p1.y)
    if (dx < 1e-9 && dy < 1e-9) continue // zero length
    const axis: "x" | "y" = dy < dx ? "y" : "x"
    if (axis === "y") {
      // horizontal segment: fixed y
      segs.push({
        traceIndex,
        segIndex: i,
        p1,
        p2,
        axis,
        fixedCoord: (p1.y + p2.y) / 2,
        min: Math.min(p1.x, p2.x),
        max: Math.max(p1.x, p2.x),
        netId,
      })
    } else {
      // vertical segment: fixed x
      segs.push({
        traceIndex,
        segIndex: i,
        p1,
        p2,
        axis,
        fixedCoord: (p1.x + p2.x) / 2,
        min: Math.min(p1.y, p2.y),
        max: Math.max(p1.y, p2.y),
        netId,
      })
    }
  }
  return segs
}

/**
 * Check if two collinear same-net segments overlap or are very close (within threshold).
 * Returns the merged segment range if they should be merged, otherwise null.
 */
function getMergedRange(
  a: Segment,
  b: Segment,
): { min: number; max: number } | null {
  if (a.axis !== b.axis) return null
  if (Math.abs(a.fixedCoord - b.fixedCoord) > MERGE_THRESHOLD) return null
  // Overlap or gap check
  const gapStart = Math.max(a.min, b.min)
  const gapEnd = Math.min(a.max, b.max)
  const gap = gapStart - gapEnd // positive = gap, negative = overlap
  if (gap > MERGE_THRESHOLD) return null // too far apart
  return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) }
}

/**
 * SameNetTraceMergeSolver
 *
 * Pipeline phase that finds pairs of trace segments on the same net that share
 * the same axis and are collinear (same fixed coordinate within a threshold).
 * When two such segments overlap or are within MERGE_THRESHOLD, the shorter
 * trace's path is adjusted so its endpoint snaps onto the longer trace, and the
 * overlapping portion is removed, resulting in a single clean segment.
 *
 * This prevents visual "double lines" on the same net caused by the upstream
 * solvers creating multiple connection pairs whose routes happen to travel
 * along the same axis at nearly the same coordinate.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  input: SameNetTraceMergeSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.allTraces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
    }))
  }

  override _step() {
    const traces = this.outputTraces

    // Group segment indices by net
    const segsByNet = new Map<string, Segment[]>()

    for (let ti = 0; ti < traces.length; ti++) {
      const trace = traces[ti]!
      const netId = trace.dcConnNetId ?? trace.globalConnNetId
      const segs = segmentsFromTrace(trace, ti, netId)
      if (!segsByNet.has(netId)) segsByNet.set(netId, [])
      segsByNet.get(netId)!.push(...segs)
    }

    let merged = false

    for (const [, segs] of segsByNet) {
      for (let i = 0; i < segs.length; i++) {
        for (let j = i + 1; j < segs.length; j++) {
          const a = segs[i]!
          const b = segs[j]!
          if (a.traceIndex === b.traceIndex) continue // same trace — skip

          const range = getMergedRange(a, b)
          if (!range) continue

          // Snap the shorter segment to the longer, removing the duplicate
          // We snap b's segment endpoints onto a's line (use a's fixedCoord)
          const targetTrace = traces[b.traceIndex]!
          const path = targetTrace.tracePath

          const fixedCoord = a.fixedCoord
          const p1 = path[b.segIndex]!
          const p2 = path[b.segIndex + 1]!

          if (b.axis === "y") {
            // horizontal: snap y
            path[b.segIndex] = { x: p1.x, y: fixedCoord }
            path[b.segIndex + 1] = { x: p2.x, y: fixedCoord }
          } else {
            // vertical: snap x
            path[b.segIndex] = { x: fixedCoord, y: p1.y }
            path[b.segIndex + 1] = { x: fixedCoord, y: p2.y }
          }

          merged = true
        }
      }
    }

    // Always solve in one step
    this.solved = true
    return merged
  }

  getOutput(): { traces: SolvedTracePath[] } {
    return { traces: this.outputTraces }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.flatMap((trace) => {
        const path = trace.tracePath
        const lines = []
        for (let i = 0; i < path.length - 1; i++) {
          lines.push({
            points: [path[i]!, path[i + 1]!],
            strokeColor: "blue",
          })
        }
        return lines
      }),
    }
  }
}
