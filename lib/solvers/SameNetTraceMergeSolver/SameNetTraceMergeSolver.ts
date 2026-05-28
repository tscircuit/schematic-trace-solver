import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"

type SegmentRef = {
  trace: SolvedTracePath
  segmentIndex: number
}

const EPS = 2e-3

const rangesOverlap = (
  a1: number,
  a2: number,
  b1: number,
  b2: number,
): boolean => {
  const minA = Math.min(a1, a2)
  const maxA = Math.max(a1, a2)
  const minB = Math.min(b1, b2)
  const maxB = Math.max(b1, b2)
  return Math.min(maxA, maxB) - Math.max(minA, minB) > EPS
}

/**
 * Snaps close, overlapping same-net internal trace segments onto a shared
 * coordinate so the renderer presents them as one combined net segment.
 */
export class SameNetTraceMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  mergeDistance: number

  outputTraces: SolvedTracePath[]
  outputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  mergedSegments: Array<SegmentRef[]> = []

  constructor(params: {
    inputProblem: InputProblem
    inputTraces: SolvedTracePath[]
    mergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.mergeDistance = params.mergeDistance ?? 0.12
    this.outputTraces = params.inputTraces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map((point) => ({ ...point })),
    }))
    this.outputTraceMap = Object.fromEntries(
      this.outputTraces.map((trace) => [trace.mspPairId, trace]),
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
      mergeDistance: this.mergeDistance,
    }
  }

  override _step() {
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.outputTraces) {
      const traces = tracesByNet.get(trace.globalConnNetId) ?? []
      traces.push(trace)
      tracesByNet.set(trace.globalConnNetId, traces)
    }

    for (const traces of tracesByNet.values()) {
      this.mergeSameNetTraceSegments(traces)
    }

    this.solved = true
  }

  private mergeSameNetTraceSegments(traces: SolvedTracePath[]) {
    for (let traceAIndex = 0; traceAIndex < traces.length; traceAIndex++) {
      const traceA = traces[traceAIndex]!
      for (
        let traceBIndex = traceAIndex + 1;
        traceBIndex < traces.length;
        traceBIndex++
      ) {
        const traceB = traces[traceBIndex]!
        this.mergeTracePair(traceA, traceB)
      }
    }
  }

  private mergeTracePair(traceA: SolvedTracePath, traceB: SolvedTracePath) {
    for (
      let segmentAIndex = 1;
      segmentAIndex < traceA.tracePath.length - 2;
      segmentAIndex++
    ) {
      const a1 = traceA.tracePath[segmentAIndex]!
      const a2 = traceA.tracePath[segmentAIndex + 1]!
      const aHorizontal = Math.abs(a1.y - a2.y) < EPS
      const aVertical = Math.abs(a1.x - a2.x) < EPS
      if (!aHorizontal && !aVertical) continue

      for (
        let segmentBIndex = 1;
        segmentBIndex < traceB.tracePath.length - 2;
        segmentBIndex++
      ) {
        const b1 = traceB.tracePath[segmentBIndex]!
        const b2 = traceB.tracePath[segmentBIndex + 1]!
        const bHorizontal = Math.abs(b1.y - b2.y) < EPS
        const bVertical = Math.abs(b1.x - b2.x) < EPS
        if (!bHorizontal && !bVertical) continue

        if (aHorizontal && bHorizontal) {
          const distance = Math.abs(a1.y - b1.y)
          if (
            distance > EPS &&
            distance <= this.mergeDistance &&
            rangesOverlap(a1.x, a2.x, b1.x, b2.x)
          ) {
            const sharedY = (a1.y + b1.y) / 2
            a1.y = sharedY
            a2.y = sharedY
            b1.y = sharedY
            b2.y = sharedY
            this.mergedSegments.push([
              { trace: traceA, segmentIndex: segmentAIndex },
              { trace: traceB, segmentIndex: segmentBIndex },
            ])
          }
        }

        if (aVertical && bVertical) {
          const distance = Math.abs(a1.x - b1.x)
          if (
            distance > EPS &&
            distance <= this.mergeDistance &&
            rangesOverlap(a1.y, a2.y, b1.y, b2.y)
          ) {
            const sharedX = (a1.x + b1.x) / 2
            a1.x = sharedX
            a2.x = sharedX
            b1.x = sharedX
            b2.x = sharedX
            this.mergedSegments.push([
              { trace: traceA, segmentIndex: segmentAIndex },
              { trace: traceB, segmentIndex: segmentBIndex },
            ])
          }
        }
      }
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: this.mergedSegments.some((segments) =>
          segments.some(
            (segment) => segment.trace.mspPairId === trace.mspPairId,
          ),
        )
          ? "orange"
          : "green",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
