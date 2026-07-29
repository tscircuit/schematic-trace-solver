import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type TracePin = SolvedTracePath["pins"][number]

export interface TraceSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  netId: string
}

type NormalizedTraceSegment = TraceSegment & {
  orientation: "horizontal" | "vertical" | "other"
}

const DEFAULT_MERGE_TOLERANCE = 0.02

const normalizeSegment = (
  segment: TraceSegment,
  tolerance = DEFAULT_MERGE_TOLERANCE,
): NormalizedTraceSegment => {
  if (Math.abs(segment.y1 - segment.y2) <= tolerance) {
    const x1 = Math.min(segment.x1, segment.x2)
    const x2 = Math.max(segment.x1, segment.x2)
    const y = (segment.y1 + segment.y2) / 2
    return { ...segment, x1, y1: y, x2, y2: y, orientation: "horizontal" }
  }

  if (Math.abs(segment.x1 - segment.x2) <= tolerance) {
    const x = (segment.x1 + segment.x2) / 2
    const y1 = Math.min(segment.y1, segment.y2)
    const y2 = Math.max(segment.y1, segment.y2)
    return { ...segment, x1: x, y1, x2: x, y2, orientation: "vertical" }
  }

  return { ...segment, orientation: "other" }
}

const rangesTouchOrOverlap = (
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  tolerance: number,
) => Math.max(aStart, bStart) <= Math.min(aEnd, bEnd) + tolerance

const tryMergeSegments = (
  a: NormalizedTraceSegment,
  b: NormalizedTraceSegment,
  tolerance: number,
): NormalizedTraceSegment | null => {
  if (a.netId !== b.netId) return null
  if (a.orientation !== b.orientation) return null
  if (a.orientation === "other") return null

  if (a.orientation === "horizontal") {
    if (Math.abs(a.y1 - b.y1) > tolerance) return null
    if (!rangesTouchOrOverlap(a.x1, a.x2, b.x1, b.x2, tolerance)) return null

    const y = (a.y1 + b.y1) / 2
    return {
      netId: a.netId,
      x1: Math.min(a.x1, b.x1),
      y1: y,
      x2: Math.max(a.x2, b.x2),
      y2: y,
      orientation: "horizontal",
    }
  }

  if (Math.abs(a.x1 - b.x1) > tolerance) return null
  if (!rangesTouchOrOverlap(a.y1, a.y2, b.y1, b.y2, tolerance)) return null

  const x = (a.x1 + b.x1) / 2
  return {
    netId: a.netId,
    x1: x,
    y1: Math.min(a.y1, b.y1),
    x2: x,
    y2: Math.max(a.y2, b.y2),
    orientation: "vertical",
  }
}

export const mergeCloseSameNetTraceSegments = (
  segments: TraceSegment[],
  tolerance = DEFAULT_MERGE_TOLERANCE,
): TraceSegment[] => {
  const merged = segments.map((segment) => normalizeSegment(segment, tolerance))

  let didMerge = true
  while (didMerge) {
    didMerge = false

    for (let i = 0; i < merged.length && !didMerge; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const candidate = tryMergeSegments(merged[i]!, merged[j]!, tolerance)
        if (!candidate) continue

        merged.splice(j, 1)
        merged[i] = candidate
        didMerge = true
        break
      }
    }
  }

  return merged.map(({ orientation: _orientation, ...segment }) => segment)
}

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.globalConnNetId ?? trace.dcConnNetId ?? trace.userNetId

const isStraightTrace = (
  trace: SolvedTracePath,
  tolerance = DEFAULT_MERGE_TOLERANCE,
) => {
  if (trace.tracePath.length !== 2) return false
  const [start, end] = trace.tracePath
  return (
    Math.abs(start!.x - end!.x) <= tolerance ||
    Math.abs(start!.y - end!.y) <= tolerance
  )
}

const segmentFromStraightTrace = (trace: SolvedTracePath): TraceSegment => {
  const [start, end] = trace.tracePath
  return {
    x1: start!.x,
    y1: start!.y,
    x2: end!.x,
    y2: end!.y,
    netId: getTraceNetId(trace),
  }
}

const segmentOrientation = (
  segment: TraceSegment,
  tolerance = DEFAULT_MERGE_TOLERANCE,
) => {
  if (Math.abs(segment.y1 - segment.y2) <= tolerance) return "horizontal"
  if (Math.abs(segment.x1 - segment.x2) <= tolerance) return "vertical"
  return "other"
}

const segmentCoversTrace = (
  merged: TraceSegment,
  source: TraceSegment,
  tolerance = DEFAULT_MERGE_TOLERANCE,
) => {
  if (merged.netId !== source.netId) return false

  const mergedOrientation = segmentOrientation(merged, tolerance)
  if (mergedOrientation !== segmentOrientation(source, tolerance)) return false

  if (mergedOrientation === "horizontal") {
    const fixedAxisMatches = Math.abs(merged.y1 - source.y1) <= tolerance
    const sourceMin = Math.min(source.x1, source.x2)
    const sourceMax = Math.max(source.x1, source.x2)
    const mergedMin = Math.min(merged.x1, merged.x2)
    const mergedMax = Math.max(merged.x1, merged.x2)
    return (
      fixedAxisMatches &&
      sourceMin >= mergedMin - tolerance &&
      sourceMax <= mergedMax + tolerance
    )
  }

  if (mergedOrientation === "vertical") {
    const fixedAxisMatches = Math.abs(merged.x1 - source.x1) <= tolerance
    const sourceMin = Math.min(source.y1, source.y2)
    const sourceMax = Math.max(source.y1, source.y2)
    const mergedMin = Math.min(merged.y1, merged.y2)
    const mergedMax = Math.max(merged.y1, merged.y2)
    return (
      fixedAxisMatches &&
      sourceMin >= mergedMin - tolerance &&
      sourceMax <= mergedMax + tolerance
    )
  }

  return false
}

const uniqueByPinId = (pins: TracePin[]) => {
  const seen = new Set<string>()
  return pins.filter((pin) => {
    if (seen.has(pin.pinId)) return false
    seen.add(pin.pinId)
    return true
  })
}

const distanceSquared = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2

const pickEndpointPins = (
  pins: TracePin[],
  start: { x: number; y: number },
  end: { x: number; y: number },
) => {
  const uniquePins = uniqueByPinId(pins)
  if (uniquePins.length < 2) return null

  const startPin = uniquePins
    .slice()
    .sort((a, b) => distanceSquared(a, start) - distanceSquared(b, start))[0]!

  const endPin =
    uniquePins
      .filter((pin) => pin.pinId !== startPin.pinId)
      .sort((a, b) => distanceSquared(a, end) - distanceSquared(b, end))[0] ??
    uniquePins
      .slice()
      .sort((a, b) => distanceSquared(a, end) - distanceSquared(b, end))[0]!

  return [startPin, endPin] as [TracePin, TracePin]
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  private outputTraces: SolvedTracePath[]

  constructor(params: { traces: SolvedTracePath[] }) {
    super()
    this.inputTraces = params.traces
    this.outputTraces = params.traces
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergeSolver
  >[0] {
    return {
      traces: this.inputTraces,
    }
  }

  override _step() {
    const straightTraceEntries = this.inputTraces
      .map((trace, index) => ({ trace, index }))
      .filter(({ trace }) => isStraightTrace(trace))

    const mergedSegments = mergeCloseSameNetTraceSegments(
      straightTraceEntries.map(({ trace }) => segmentFromStraightTrace(trace)),
    )

    const consumedTraceIndexes = new Set<number>()
    const mergedTraces: SolvedTracePath[] = []

    for (const mergedSegment of mergedSegments) {
      const sourceEntries = straightTraceEntries.filter(({ trace, index }) => {
        if (consumedTraceIndexes.has(index)) return false
        return segmentCoversTrace(
          mergedSegment,
          segmentFromStraightTrace(trace),
        )
      })

      if (sourceEntries.length <= 1) continue

      for (const { index } of sourceEntries) {
        consumedTraceIndexes.add(index)
      }

      const sourceTraces = sourceEntries.map(({ trace }) => trace)
      const representative = sourceTraces[0]!
      const mspConnectionPairIds = Array.from(
        new Set(
          sourceTraces.flatMap((trace) => [
            ...(trace.mspConnectionPairIds ?? []),
            trace.mspPairId,
          ]),
        ),
      )
      const tracePath = [
        { x: mergedSegment.x1, y: mergedSegment.y1 },
        { x: mergedSegment.x2, y: mergedSegment.y2 },
      ]
      const endpointPins = pickEndpointPins(
        sourceTraces.flatMap((trace) => trace.pins),
        tracePath[0]!,
        tracePath[1]!,
      )

      mergedTraces.push({
        ...representative,
        mspPairId: `same-net-merge-${mspConnectionPairIds.join("-")}`,
        tracePath,
        mspConnectionPairIds,
        pinIds: Array.from(
          new Set(sourceTraces.flatMap((trace) => trace.pinIds)),
        ),
        pins: endpointPins ?? representative.pins,
      })
    }

    this.outputTraces = [
      ...this.inputTraces.filter(
        (_, index) => !consumedTraceIndexes.has(index),
      ),
      ...mergedTraces,
    ]
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }
}
