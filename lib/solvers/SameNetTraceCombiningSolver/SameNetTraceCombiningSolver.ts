import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Axis = "horizontal" | "vertical"

export interface SameNetTraceCombiningSolverInput {
  traces: SolvedTracePath[]
  maxDistance?: number
  minOverlap?: number
}

interface AxisSegment {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  rangeMin: number
  rangeMax: number
  length: number
}

const EPS = 1e-9
const DEFAULT_MAX_DISTANCE = 0.15
const DEFAULT_MIN_OVERLAP = 0.05
const MAX_PASSES = 8

export class SameNetTraceCombiningSolver extends BaseSolver {
  private input: SameNetTraceCombiningSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceCombiningSolverInput) {
    super()
    this.input = input
    this.outputTraces = cloneTraces(input.traces)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceCombiningSolver
  >[0] {
    return this.input
  }

  override _step() {
    this.stats.combinedSegments = this.combineCloseSameNetSegments()
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      combinedSegments: this.stats.combinedSegments as number,
    }
  }

  private combineCloseSameNetSegments() {
    const maxDistance = this.input.maxDistance ?? DEFAULT_MAX_DISTANCE
    const minOverlap = this.input.minOverlap ?? DEFAULT_MIN_OVERLAP
    let combinedSegments = 0

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let changedThisPass = false
      const traceIndexesByNet = groupTraceIndexesByNet(this.outputTraces)

      for (const traceIndexes of traceIndexesByNet.values()) {
        for (let i = 0; i < traceIndexes.length - 1; i++) {
          for (let j = i + 1; j < traceIndexes.length; j++) {
            const didCombine = this.tryCombineTracePair({
              traceIndexA: traceIndexes[i]!,
              traceIndexB: traceIndexes[j]!,
              maxDistance,
              minOverlap,
            })

            if (didCombine) {
              combinedSegments++
              changedThisPass = true
            }
          }
        }
      }

      if (!changedThisPass) break
    }

    return combinedSegments
  }

  private tryCombineTracePair(params: {
    traceIndexA: number
    traceIndexB: number
    maxDistance: number
    minOverlap: number
  }) {
    const { traceIndexA, traceIndexB, maxDistance, minOverlap } = params
    const segmentsA = getMovableAxisSegments(
      this.outputTraces[traceIndexA]!,
      traceIndexA,
    )
    const segmentsB = getMovableAxisSegments(
      this.outputTraces[traceIndexB]!,
      traceIndexB,
    )

    for (const segmentA of segmentsA) {
      for (const segmentB of segmentsB) {
        if (segmentA.axis !== segmentB.axis) continue

        const distance = Math.abs(segmentA.fixedCoord - segmentB.fixedCoord)
        if (distance <= EPS || distance > maxDistance + EPS) continue

        const overlap = getRangeOverlap(segmentA, segmentB)
        if (overlap < minOverlap - EPS) continue

        const [target, mover] =
          segmentA.length >= segmentB.length
            ? [segmentA, segmentB]
            : [segmentB, segmentA]

        if (this.tryMoveSegmentOntoAxis(mover, target.fixedCoord)) {
          return true
        }
      }
    }

    return false
  }

  private tryMoveSegmentOntoAxis(segment: AxisSegment, fixedCoord: number) {
    const originalTrace = this.outputTraces[segment.traceIndex]!
    const originalCrossings = countDifferentNetStrictCrossings(
      originalTrace,
      this.outputTraces,
    )
    const candidateTrace = moveTraceSegmentOntoAxis(
      originalTrace,
      segment,
      fixedCoord,
    )
    const candidateTraces = this.outputTraces.map((trace, index) =>
      index === segment.traceIndex ? candidateTrace : trace,
    )
    const candidateCrossings = countDifferentNetStrictCrossings(
      candidateTrace,
      candidateTraces,
    )

    if (candidateCrossings > originalCrossings) return false

    this.outputTraces[segment.traceIndex] = candidateTrace
    return true
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath,
      strokeColor: "blue",
    }))

    return {
      lines,
      points: [],
      rects: [],
      circles: [],
      texts: [],
    }
  }
}

const cloneTraces = (traces: SolvedTracePath[]): SolvedTracePath[] =>
  traces.map((trace) => ({
    ...trace,
    pins: [{ ...trace.pins[0] }, { ...trace.pins[1] }],
    mspConnectionPairIds: [...trace.mspConnectionPairIds],
    pinIds: [...trace.pinIds],
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.globalConnNetId ?? trace.dcConnNetId

const groupTraceIndexesByNet = (traces: SolvedTracePath[]) => {
  const indexesByNet = new Map<string, number[]>()

  traces.forEach((trace, index) => {
    const netId = getTraceNetId(trace)
    if (!netId) return

    const indexes = indexesByNet.get(netId) ?? []
    indexes.push(index)
    indexesByNet.set(netId, indexes)
  })

  return indexesByNet
}

const getMovableAxisSegments = (trace: SolvedTracePath, traceIndex: number) => {
  const segments: AxisSegment[] = []

  for (let i = 1; i < trace.tracePath.length - 2; i++) {
    const segment = getAxisSegment(
      trace.tracePath[i]!,
      trace.tracePath[i + 1]!,
      traceIndex,
      i,
    )
    if (segment) segments.push(segment)
  }

  return segments
}

const getAxisSegment = (
  start: Point,
  end: Point,
  traceIndex: number,
  segmentIndex: number,
): AxisSegment | null => {
  if (sameY(start, end) && Math.abs(start.x - end.x) > EPS) {
    const rangeMin = Math.min(start.x, end.x)
    const rangeMax = Math.max(start.x, end.x)
    return {
      traceIndex,
      segmentIndex,
      axis: "horizontal",
      fixedCoord: start.y,
      rangeMin,
      rangeMax,
      length: rangeMax - rangeMin,
    }
  }

  if (sameX(start, end) && Math.abs(start.y - end.y) > EPS) {
    const rangeMin = Math.min(start.y, end.y)
    const rangeMax = Math.max(start.y, end.y)
    return {
      traceIndex,
      segmentIndex,
      axis: "vertical",
      fixedCoord: start.x,
      rangeMin,
      rangeMax,
      length: rangeMax - rangeMin,
    }
  }

  return null
}

const moveTraceSegmentOntoAxis = (
  trace: SolvedTracePath,
  segment: AxisSegment,
  fixedCoord: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((point) => ({ ...point }))
  const start = tracePath[segment.segmentIndex]!
  const end = tracePath[segment.segmentIndex + 1]!

  if (segment.axis === "horizontal") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }

  return {
    ...trace,
    tracePath: simplifyOrthogonalPath(tracePath),
  }
}

const simplifyOrthogonalPath = (path: Point[]) => {
  const deduped = path.filter(
    (point, index) => index === 0 || !pointsEqual(point, path[index - 1]!),
  )

  if (deduped.length < 3) return deduped

  const simplified: Point[] = [deduped[0]!]
  for (let i = 1; i < deduped.length - 1; i++) {
    const prev = simplified[simplified.length - 1]!
    const point = deduped[i]!
    const next = deduped[i + 1]!

    if (
      (sameX(prev, point) && sameX(point, next)) ||
      (sameY(prev, point) && sameY(point, next))
    ) {
      continue
    }

    simplified.push(point)
  }

  simplified.push(deduped[deduped.length - 1]!)
  return simplified
}

const countDifferentNetStrictCrossings = (
  trace: SolvedTracePath,
  allTraces: SolvedTracePath[],
) => {
  let crossings = 0

  for (const otherTrace of allTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    if (getTraceNetId(otherTrace) === getTraceNetId(trace)) continue

    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
        if (
          segmentsStrictlyCross(
            trace.tracePath[i]!,
            trace.tracePath[i + 1]!,
            otherTrace.tracePath[j]!,
            otherTrace.tracePath[j + 1]!,
          )
        ) {
          crossings++
        }
      }
    }
  }

  return crossings
}

const segmentsStrictlyCross = (a1: Point, a2: Point, b1: Point, b2: Point) => {
  if (sameX(a1, a2) && sameY(b1, b2)) {
    return (
      a1.x > Math.min(b1.x, b2.x) + EPS &&
      a1.x < Math.max(b1.x, b2.x) - EPS &&
      b1.y > Math.min(a1.y, a2.y) + EPS &&
      b1.y < Math.max(a1.y, a2.y) - EPS
    )
  }

  if (sameY(a1, a2) && sameX(b1, b2)) {
    return (
      b1.x > Math.min(a1.x, a2.x) + EPS &&
      b1.x < Math.max(a1.x, a2.x) - EPS &&
      a1.y > Math.min(b1.y, b2.y) + EPS &&
      a1.y < Math.max(b1.y, b2.y) - EPS
    )
  }

  return false
}

const getRangeOverlap = (a: AxisSegment, b: AxisSegment) =>
  Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin)

const pointsEqual = (a: Point, b: Point) => sameX(a, b) && sameY(a, b)

const sameX = (a: Point, b: Point) => Math.abs(a.x - b.x) <= EPS

const sameY = (a: Point, b: Point) => Math.abs(a.y - b.y) <= EPS
