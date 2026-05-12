import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

type TraceEndpoint = {
  point: Point
}

type OrthogonalSegment = {
  start: Point
  end: Point
  orientation: "horizontal" | "vertical"
}

type BridgeCandidate = {
  traceA: SolvedTracePath
  traceB: SolvedTracePath
  pointA: Point
  pointB: Point
}

export class TraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  outputTraces: SolvedTracePath[]
  mergeDistance: number
  alignmentDistance: number
  private originalTraceIds: Set<string>
  private bridgeKeys = new Set<string>()
  private bridgedTracePairs = new Set<string>()

  constructor(params: {
    inputProblem: InputProblem
    traces: SolvedTracePath[]
    mergeDistance?: number
    alignmentDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.traces
    this.outputTraces = [...params.traces]
    this.mergeDistance = params.mergeDistance ?? 0.25
    this.alignmentDistance = params.alignmentDistance ?? 0.08
    this.originalTraceIds = new Set(
      params.traces.map((trace) => trace.mspPairId),
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceSegmentMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.inputTraces,
      mergeDistance: this.mergeDistance,
      alignmentDistance: this.alignmentDistance,
    }
  }

  override _step() {
    const nextBridge = this.findNextBridgeCandidate()

    if (!nextBridge) {
      this.solved = true
      return
    }

    this.addBridgeTrace(nextBridge)
  }

  private findNextBridgeCandidate(): BridgeCandidate | null {
    const originalTraces = this.outputTraces.filter((trace) =>
      this.originalTraceIds.has(trace.mspPairId),
    )

    for (let i = 0; i < originalTraces.length; i++) {
      const traceA = originalTraces[i]!
      for (let j = i + 1; j < originalTraces.length; j++) {
        const traceB = originalTraces[j]!
        if (traceA.globalConnNetId !== traceB.globalConnNetId) continue
        if (this.bridgedTracePairs.has(this.getTracePairKey(traceA, traceB))) {
          continue
        }

        const endpointCandidate = this.findEndpointBridge(traceA, traceB)
        if (endpointCandidate) return endpointCandidate

        const segmentCandidate = this.findParallelSegmentBridge(traceA, traceB)
        if (segmentCandidate) return segmentCandidate
      }
    }

    return null
  }

  private findEndpointBridge(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
  ): BridgeCandidate | null {
    const endpointsA = this.getEndpoints(traceA)
    const endpointsB = this.getEndpoints(traceB)

    for (const endpointA of endpointsA) {
      for (const endpointB of endpointsB) {
        if (this.areSamePoint(endpointA.point, endpointB.point)) continue
        if (!this.arePointsBridgeable(endpointA.point, endpointB.point)) {
          continue
        }
        const candidate = {
          traceA,
          traceB,
          pointA: endpointA.point,
          pointB: endpointB.point,
        }
        if (!this.hasBridge(candidate)) return candidate
      }
    }

    return null
  }

  private findParallelSegmentBridge(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
  ): BridgeCandidate | null {
    const segmentsA = this.getOrthogonalSegments(traceA)
    const segmentsB = this.getOrthogonalSegments(traceB)

    for (const segmentA of segmentsA) {
      for (const segmentB of segmentsB) {
        if (segmentA.orientation !== segmentB.orientation) continue

        const bridgePoints = this.getParallelBridgePoints(segmentA, segmentB)
        if (!bridgePoints) continue
        if (this.areSamePoint(bridgePoints.pointA, bridgePoints.pointB)) {
          continue
        }

        const candidate = {
          traceA,
          traceB,
          pointA: bridgePoints.pointA,
          pointB: bridgePoints.pointB,
        }
        if (!this.hasBridge(candidate)) return candidate
      }
    }

    return null
  }

  private getEndpoints(trace: SolvedTracePath): TraceEndpoint[] {
    return [
      { point: trace.tracePath[0]! },
      {
        point: trace.tracePath[trace.tracePath.length - 1]!,
      },
    ]
  }

  private getOrthogonalSegments(trace: SolvedTracePath): OrthogonalSegment[] {
    const segments: OrthogonalSegment[] = []

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      if (Math.abs(start.y - end.y) <= this.alignmentDistance) {
        segments.push({
          start,
          end,
          orientation: "horizontal",
        })
      } else if (Math.abs(start.x - end.x) <= this.alignmentDistance) {
        segments.push({
          start,
          end,
          orientation: "vertical",
        })
      }
    }

    return segments
  }

  private getParallelBridgePoints(
    segmentA: OrthogonalSegment,
    segmentB: OrthogonalSegment,
  ): { pointA: Point; pointB: Point } | null {
    if (segmentA.orientation === "horizontal") {
      const yA = (segmentA.start.y + segmentA.end.y) / 2
      const yB = (segmentB.start.y + segmentB.end.y) / 2
      if (Math.abs(yA - yB) > this.mergeDistance) return null

      const overlap = this.getRangeOverlap(
        segmentA.start.x,
        segmentA.end.x,
        segmentB.start.x,
        segmentB.end.x,
      )
      if (!overlap) return null

      const x = (overlap[0] + overlap[1]) / 2
      return {
        pointA: { x, y: yA },
        pointB: { x, y: yB },
      }
    }

    const xA = (segmentA.start.x + segmentA.end.x) / 2
    const xB = (segmentB.start.x + segmentB.end.x) / 2
    if (Math.abs(xA - xB) > this.mergeDistance) return null

    const overlap = this.getRangeOverlap(
      segmentA.start.y,
      segmentA.end.y,
      segmentB.start.y,
      segmentB.end.y,
    )
    if (!overlap) return null

    const y = (overlap[0] + overlap[1]) / 2
    return {
      pointA: { x: xA, y },
      pointB: { x: xB, y },
    }
  }

  private getRangeOverlap(
    a1: number,
    a2: number,
    b1: number,
    b2: number,
  ): [number, number] | null {
    const minA = Math.min(a1, a2)
    const maxA = Math.max(a1, a2)
    const minB = Math.min(b1, b2)
    const maxB = Math.max(b1, b2)
    const start = Math.max(minA, minB)
    const end = Math.min(maxA, maxB)
    if (start <= end) return [start, end]

    return null
  }

  private arePointsBridgeable(pointA: Point, pointB: Point): boolean {
    const dx = Math.abs(pointA.x - pointB.x)
    const dy = Math.abs(pointA.y - pointB.y)

    if (dx <= this.alignmentDistance && dy <= this.mergeDistance) return true
    if (dy <= this.alignmentDistance && dx <= this.mergeDistance) return true

    return dx * dx + dy * dy <= this.mergeDistance * this.mergeDistance
  }

  private addBridgeTrace(candidate: BridgeCandidate) {
    const bridgeKey = this.getBridgeKey(candidate)
    this.bridgeKeys.add(bridgeKey)
    this.bridgedTracePairs.add(
      this.getTracePairKey(candidate.traceA, candidate.traceB),
    )

    const bridgeTrace: SolvedTracePath = {
      ...candidate.traceA,
      mspPairId: `trace-segment-merge-${this.bridgeKeys.size}-${candidate.traceA.mspPairId}-${candidate.traceB.mspPairId}`,
      pins: [candidate.traceA.pins[1], candidate.traceB.pins[0]],
      tracePath: this.buildBridgePath(candidate.pointA, candidate.pointB),
      mspConnectionPairIds: Array.from(
        new Set([
          ...(candidate.traceA.mspConnectionPairIds ?? [
            candidate.traceA.mspPairId,
          ]),
          ...(candidate.traceB.mspConnectionPairIds ?? [
            candidate.traceB.mspPairId,
          ]),
        ]),
      ),
      pinIds: Array.from(
        new Set([...candidate.traceA.pinIds, ...candidate.traceB.pinIds]),
      ),
    }

    this.outputTraces.push(bridgeTrace)
  }

  private buildBridgePath(pointA: Point, pointB: Point): Point[] {
    if (
      Math.abs(pointA.x - pointB.x) <= this.alignmentDistance ||
      Math.abs(pointA.y - pointB.y) <= this.alignmentDistance
    ) {
      return this.dedupeConsecutivePoints([pointA, pointB])
    }

    return this.dedupeConsecutivePoints([
      pointA,
      { x: pointB.x, y: pointA.y },
      pointB,
    ])
  }

  private dedupeConsecutivePoints(points: Point[]): Point[] {
    return points.filter((point, index) => {
      const previous = points[index - 1]
      return !previous || !this.areSamePoint(previous, point)
    })
  }

  private hasBridge(candidate: BridgeCandidate): boolean {
    return (
      this.bridgeKeys.has(this.getBridgeKey(candidate)) ||
      this.bridgedTracePairs.has(
        this.getTracePairKey(candidate.traceA, candidate.traceB),
      )
    )
  }

  private getBridgeKey(candidate: BridgeCandidate): string {
    const pointKeys = [
      this.getPointKey(candidate.pointA),
      this.getPointKey(candidate.pointB),
    ].sort()
    const traceIds = [candidate.traceA.mspPairId, candidate.traceB.mspPairId]
      .sort()
      .join("|")
    return `${traceIds}:${pointKeys.join("|")}`
  }

  private getTracePairKey(
    traceA: SolvedTracePath,
    traceB: SolvedTracePath,
  ): string {
    return [traceA.mspPairId, traceB.mspPairId].sort().join("|")
  }

  private getPointKey(point: Point): string {
    return `${point.x.toFixed(4)},${point.y.toFixed(4)}`
  }

  private areSamePoint(pointA: Point, pointB: Point): boolean {
    return (
      Math.abs(pointA.x - pointB.x) <= 1e-6 &&
      Math.abs(pointA.y - pointB.y) <= 1e-6
    )
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of this.outputTraces) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: this.originalTraceIds.has(trace.mspPairId)
          ? getColorFromString(trace.globalConnNetId)
          : "green",
        strokeWidth: this.originalTraceIds.has(trace.mspPairId) ? 0.02 : 0.04,
      })
    }

    return graphics
  }
}
