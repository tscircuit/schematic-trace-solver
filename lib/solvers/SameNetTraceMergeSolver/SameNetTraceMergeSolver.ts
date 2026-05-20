import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface SameNetTraceMergeSolverParams {
  traces: SolvedTracePath[]
  gapThreshold?: number
}

type Axis = "x" | "y"

interface StraightTrace {
  trace: SolvedTracePath
  axis: Axis
  fixed: number
  min: number
  max: number
  start: Point
  end: Point
}

const DEFAULT_GAP_THRESHOLD = 0.15
const EPSILON = 1e-9

const nearlyEqual = (a: number, b: number) => Math.abs(a - b) <= EPSILON

const idsFor = (trace: SolvedTracePath) =>
  trace.mspConnectionPairIds.length > 0
    ? trace.mspConnectionPairIds
    : [trace.mspPairId]

const asStraightTrace = (trace: SolvedTracePath): StraightTrace | null => {
  if (trace.tracePath.length < 2) return null

  const first = trace.tracePath[0]!
  const last = trace.tracePath[trace.tracePath.length - 1]!
  const isHorizontal = trace.tracePath.every((p) => nearlyEqual(p.y, first.y))
  const isVertical = trace.tracePath.every((p) => nearlyEqual(p.x, first.x))

  if (!isHorizontal && !isVertical) return null

  if (isHorizontal) {
    const xs = trace.tracePath.map((p) => p.x)
    return {
      trace,
      axis: "x",
      fixed: first.y,
      min: Math.min(...xs),
      max: Math.max(...xs),
      start: first,
      end: last,
    }
  }

  const ys = trace.tracePath.map((p) => p.y)
  return {
    trace,
    axis: "y",
    fixed: first.x,
    min: Math.min(...ys),
    max: Math.max(...ys),
    start: first,
    end: last,
  }
}

const getGap = (a: StraightTrace, b: StraightTrace) => {
  if (a.max < b.min) return b.min - a.max
  if (b.max < a.min) return a.min - b.max
  return 0
}

const canMerge = (
  a: StraightTrace,
  b: StraightTrace,
  gapThreshold: number,
) => {
  if (a.trace.globalConnNetId !== b.trace.globalConnNetId) return false
  if (a.axis !== b.axis) return false
  if (!nearlyEqual(a.fixed, b.fixed)) return false
  return getGap(a, b) <= gapThreshold
}

const mergePair = (a: StraightTrace, b: StraightTrace): SolvedTracePath => {
  const min = Math.min(a.min, b.min)
  const max = Math.max(a.max, b.max)
  const tracePath =
    a.axis === "x"
      ? [
          { x: min, y: a.fixed },
          { x: max, y: a.fixed },
        ]
      : [
          { x: a.fixed, y: min },
          { x: a.fixed, y: max },
        ]

  const mspConnectionPairIds = [...idsFor(a.trace), ...idsFor(b.trace)]
  const pinIds = Array.from(new Set([...a.trace.pinIds, ...b.trace.pinIds]))

  return {
    ...a.trace,
    mspPairId: mspConnectionPairIds.join("+"),
    mspConnectionPairIds,
    pinIds,
    pins: [a.trace.pins[0], b.trace.pins[1]],
    tracePath,
  }
}

/**
 * Merges straight, collinear trace segments on the same global net when their
 * endpoints are already touching or separated by only a tiny gap.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  private outputTraces: SolvedTracePath[]
  private gapThreshold: number

  constructor(params: SameNetTraceMergeSolverParams) {
    super()
    this.outputTraces = [...params.traces]
    this.gapThreshold = params.gapThreshold ?? DEFAULT_GAP_THRESHOLD
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      traces: this.outputTraces,
      gapThreshold: this.gapThreshold,
    }
  }

  override _step() {
    let merged = true

    while (merged) {
      merged = false

      for (let i = 0; i < this.outputTraces.length; i++) {
        const a = asStraightTrace(this.outputTraces[i]!)
        if (!a) continue

        for (let j = i + 1; j < this.outputTraces.length; j++) {
          const b = asStraightTrace(this.outputTraces[j]!)
          if (!b) continue
          if (!canMerge(a, b, this.gapThreshold)) continue

          const mergedTrace = mergePair(a, b)
          this.outputTraces.splice(j, 1)
          this.outputTraces.splice(i, 1, mergedTrace)
          merged = true
          break
        }

        if (merged) break
      }
    }

    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
