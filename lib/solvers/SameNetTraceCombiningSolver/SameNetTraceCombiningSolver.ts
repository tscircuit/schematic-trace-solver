import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Axis = "horizontal" | "vertical"

type SameNetTraceCombiningSolverInput = {
  traces: SolvedTracePath[]
  mergeDistance?: number
  minOverlap?: number
}

type AxisSegment = {
  traceIndex: number
  segmentIndex: number
  axis: Axis
  fixedCoord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-9
const DEFAULT_MERGE_DISTANCE = 0.15
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

  override _step() {
    this.combineCloseSameNetSegments()
    this.solved = true
  }

  private combineCloseSameNetSegments() {
    const mergeDistance = this.input.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    const minOverlap = this.input.minOverlap ?? DEFAULT_MIN_OVERLAP

    let combinedSegments = 0

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let changedThisPass = false
      const traceIndexesByNet = groupTraceIndexesByNet(this.outputTraces)

      for (const traceIndexes of traceIndexesByNet.values()) {
        if (traceIndexes.length < 2) continue

        for (let a = 0; a < traceIndexes.length - 1; a++) {
          for (let b = a + 1; b < traceIndexes.length; b++) {
            const traceIndexA = traceIndexes[a]!
            const traceIndexB = traceIndexes[b]!
            const combined = this.tryCombineTracePair({
              traceIndexA,
              traceIndexB,
              mergeDistance,
              minOverlap,
            })

            if (combined) {
              changedThisPass = true
              combinedSegments++
            }
          }
        }
      }

      if (!changedThisPass) break
    }

    this.stats.combinedSegments = combinedSegments
  }

  private tryCombineTracePair(params: {
    traceIndexA: number
    traceIndexB: number
    mergeDistance: number
    minOverlap: number
  }) {
    const { traceIndexA, traceIndexB, mergeDistance, minOverlap } = params
    const traceA = this.outputTraces[traceIndexA]!
    const traceB = this.outputTraces[traceIndexB]!
    const segmentsA = getMovableAxisSegments(traceA, traceIndexA)
    const segmentsB = getMovableAxisSegments(traceB, traceIndexB)

    for (const segmentA of segmentsA) {
      for (const segmentB of segmentsB) {
        if (segmentA.axis !== segmentB.axis) continue

        const orthogonalDistance = Math.abs(
          segmentA.fixedCoord - segmentB.fixedCoord,
        )
        if (
          orthogonalDistance <= EPS ||
          orthogonalDistance > mergeDistance + EPS
        ) {
          continue
        }

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
    const trace = this.outputTraces[segment.traceIndex]!
    const currentCrossings = countDifferentNetStrictCrossings(
      trace,
      this.outputTraces,
    )
    const candidateTrace = moveTraceSegmentOntoAxis(trace, segment, fixedCoord)
    const candidateCrossings = countDifferentNetStrictCrossings(
      candidateTrace,
      this.outputTraces.map((otherTrace, index) =>
        index === segment.traceIndex ? candidateTrace : otherTrace,
      ),
    )

    if (candidateCrossings > currentCrossings) {
      return false
    }

    this.outputTraces[segment.traceIndex] = candidateTrace
    return true
  }
}

const cloneTraces = (traces: SolvedTracePath[]) =>
  traces.map((trace) => ({
    ...trace,
    pins: [...trace.pins] as SolvedTracePath["pins"],
    pinIds: [...trace.pinIds],
    mspConnectionPairIds: [...trace.mspConnectionPairIds],
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

const groupTraceIndexesByNet = (traces: SolvedTracePath[]) => {
  const indexesByNet = new Map<string, number[]>()

  traces.forEach((trace, index) => {
    const netId = trace.globalConnNetId
    if (!netId) return
    const indexes = indexesByNet.get(netId) ?? []
    indexes.push(index)
    indexesByNet.set(netId, indexes)
  })

  return indexesByNet
}

const getMovableAxisSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): AxisSegment[] => {
  const segments: AxisSegment[] = []

  for (let i = 1; i < trace.tracePath.length - 2; i++) {
    const start = trace.tracePath[i]!
    const end = trace.tracePath[i + 1]!
    const segment = getAxisSegment(start, end, traceIndex, i)
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
    const min = Math.min(start.x, end.x)
    const max = Math.max(start.x, end.x)
    return {
      traceIndex,
      segmentIndex,
      axis: "horizontal",
      fixedCoord: start.y,
      min,
      max,
      length: max - min,
    }
  }

  if (sameX(start, end) && Math.abs(start.y - end.y) > EPS) {
    const min = Math.min(start.y, end.y)
    const max = Math.max(start.y, end.y)
    return {
      traceIndex,
      segmentIndex,
      axis: "vertical",
      fixedCoord: start.x,
      min,
      max,
      length: max - min,
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
  let crossingCount = 0

  for (const otherTrace of allTraces) {
    if (otherTrace.mspPairId === trace.mspPairId) continue
    if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

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
          crossingCount++
        }
      }
    }
  }

  return crossingCount
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
  Math.min(a.max, b.max) - Math.max(a.min, b.min)

const pointsEqual = (a: Point, b: Point) => sameX(a, b) && sameY(a, b)

const sameX = (a: Point, b: Point) => Math.abs(a.x - b.x) <= EPS

const sameY = (a: Point, b: Point) => Math.abs(a.y - b.y) <= EPS
