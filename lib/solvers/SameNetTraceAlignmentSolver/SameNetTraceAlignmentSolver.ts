import { doSegmentsIntersect, type Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const EPS = 1e-6
const DEFAULT_ALIGNMENT_DISTANCE = 0.15

type Orientation = "horizontal" | "vertical"

interface SameNetTraceAlignmentSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  alignmentDistance?: number
}

interface TraceSegment {
  trace: SolvedTracePath
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  axis: number
  min: number
  max: number
  length: number
}

interface AlignmentCandidate {
  moving: TraceSegment
  anchor: TraceSegment
  targetAxis: number
}

const isSamePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const isCollinear = (a: Point, b: Point, c: Point) =>
  (Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS) ||
  (Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS)

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  pins: [...trace.pins] as SolvedTracePath["pins"],
  tracePath: trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  pinIds: [...trace.pinIds],
})

const normalizeTracePath = (tracePath: Point[]): Point[] => {
  const withoutDuplicates: Point[] = []
  for (const point of tracePath) {
    const last = withoutDuplicates.at(-1)
    if (!last || !isSamePoint(last, point)) {
      withoutDuplicates.push({ x: point.x, y: point.y })
    }
  }

  const normalized: Point[] = []
  for (const point of withoutDuplicates) {
    while (
      normalized.length >= 2 &&
      isCollinear(normalized[normalized.length - 2]!, normalized.at(-1)!, point)
    ) {
      normalized.pop()
    }
    normalized.push(point)
  }

  return normalized
}

const getSegmentOrientation = (start: Point, end: Point) => {
  if (Math.abs(start.y - end.y) < EPS) return "horizontal"
  if (Math.abs(start.x - end.x) < EPS) return "vertical"
  return null
}

const getSegments = (traces: SolvedTracePath[]): TraceSegment[] => {
  const segments: TraceSegment[] = []

  traces.forEach((trace, traceIndex) => {
    const tracePath = trace.tracePath
    for (
      let segmentIndex = 0;
      segmentIndex < tracePath.length - 1;
      segmentIndex++
    ) {
      const start = tracePath[segmentIndex]!
      const end = tracePath[segmentIndex + 1]!
      const orientation = getSegmentOrientation(start, end)
      if (!orientation) continue

      segments.push({
        trace,
        traceIndex,
        segmentIndex,
        orientation,
        axis: orientation === "horizontal" ? start.y : start.x,
        min:
          orientation === "horizontal"
            ? Math.min(start.x, end.x)
            : Math.min(start.y, end.y),
        max:
          orientation === "horizontal"
            ? Math.max(start.x, end.x)
            : Math.max(start.y, end.y),
        length:
          orientation === "horizontal"
            ? Math.abs(start.x - end.x)
            : Math.abs(start.y - end.y),
      })
    }
  })

  return segments
}

const overlapsAlongRun = (a: TraceSegment, b: TraceSegment) =>
  Math.min(a.max, b.max) - Math.max(a.min, b.min) > EPS

const isMovableSegment = (segment: TraceSegment) => {
  const lastSegmentIndex = segment.trace.tracePath.length - 2
  return segment.segmentIndex > 0 && segment.segmentIndex < lastSegmentIndex
}

const getAlignmentKey = (candidate: AlignmentCandidate) =>
  [
    candidate.moving.trace.mspPairId,
    candidate.moving.segmentIndex,
    candidate.anchor.trace.mspPairId,
    candidate.anchor.segmentIndex,
    candidate.targetAxis.toFixed(6),
  ].join(":")

export class SameNetTraceAlignmentSolver extends BaseSolver {
  inputProblem: InputProblem
  alignmentDistance: number
  alignedTraceMap: Record<string, SolvedTracePath>
  private rejectedCandidateKeys = new Set<string>()

  constructor(params: SameNetTraceAlignmentSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.alignmentDistance =
      params.alignmentDistance ?? DEFAULT_ALIGNMENT_DISTANCE
    this.alignedTraceMap = Object.fromEntries(
      params.traces.map((trace) => [trace.mspPairId, cloneTrace(trace)]),
    )
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceAlignmentSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: Object.values(this.alignedTraceMap),
      alignmentDistance: this.alignmentDistance,
    }
  }

  private findNextCandidate(): AlignmentCandidate | null {
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of Object.values(this.alignedTraceMap)) {
      const netTraces = tracesByNet.get(trace.globalConnNetId) ?? []
      netTraces.push(trace)
      tracesByNet.set(trace.globalConnNetId, netTraces)
    }

    for (const traces of tracesByNet.values()) {
      if (traces.length < 2) continue

      const segments = getSegments(traces).filter(isMovableSegment)
      for (let i = 0; i < segments.length; i++) {
        const a = segments[i]!
        for (let j = i + 1; j < segments.length; j++) {
          const b = segments[j]!
          if (a.trace.mspPairId === b.trace.mspPairId) continue
          if (a.orientation !== b.orientation) continue
          if (!overlapsAlongRun(a, b)) continue

          const axisDistance = Math.abs(a.axis - b.axis)
          if (axisDistance < EPS || axisDistance > this.alignmentDistance) {
            continue
          }

          const candidate =
            a.length >= b.length
              ? { moving: b, anchor: a, targetAxis: a.axis }
              : { moving: a, anchor: b, targetAxis: b.axis }

          if (!this.rejectedCandidateKeys.has(getAlignmentKey(candidate))) {
            return candidate
          }
        }
      }
    }

    return null
  }

  private getTraceWithAlignedSegment(candidate: AlignmentCandidate) {
    const trace = cloneTrace(candidate.moving.trace)
    const start = trace.tracePath[candidate.moving.segmentIndex]!
    const end = trace.tracePath[candidate.moving.segmentIndex + 1]!

    if (candidate.moving.orientation === "horizontal") {
      start.y = candidate.targetAxis
      end.y = candidate.targetAxis
    } else {
      start.x = candidate.targetAxis
      end.x = candidate.targetAxis
    }

    trace.tracePath = normalizeTracePath(trace.tracePath)
    return trace
  }

  private getIntersectionKeys(trace: SolvedTracePath) {
    const keys = new Set<string>()

    for (const otherTrace of Object.values(this.alignedTraceMap)) {
      if (otherTrace.mspPairId === trace.mspPairId) continue
      if (otherTrace.globalConnNetId === trace.globalConnNetId) continue

      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const a1 = trace.tracePath[i]!
        const a2 = trace.tracePath[i + 1]!
        for (let j = 0; j < otherTrace.tracePath.length - 1; j++) {
          const b1 = otherTrace.tracePath[j]!
          const b2 = otherTrace.tracePath[j + 1]!
          if (doSegmentsIntersect(a1, a2, b1, b2)) {
            keys.add(`${otherTrace.mspPairId}:${j}`)
          }
        }
      }
    }

    return keys
  }

  private wouldCreateDifferentNetIntersection(nextTrace: SolvedTracePath) {
    const previousTrace = this.alignedTraceMap[nextTrace.mspPairId]!
    const previousIntersections = this.getIntersectionKeys(previousTrace)
    const nextIntersections = this.getIntersectionKeys(nextTrace)

    for (const key of nextIntersections) {
      if (!previousIntersections.has(key)) return true
    }

    return false
  }

  override _step() {
    const candidate = this.findNextCandidate()
    if (!candidate) {
      this.solved = true
      return
    }

    const nextTrace = this.getTraceWithAlignedSegment(candidate)
    if (this.wouldCreateDifferentNetIntersection(nextTrace)) {
      this.rejectedCandidateKeys.add(getAlignmentKey(candidate))
      return
    }

    this.alignedTraceMap[nextTrace.mspPairId] = nextTrace
    this.rejectedCandidateKeys.clear()
  }

  getOutput() {
    return {
      traces: Object.values(this.alignedTraceMap),
      traceMap: this.alignedTraceMap,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    for (const trace of Object.values(this.alignedTraceMap)) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "purple",
      }
      graphics.lines!.push(line)
    }

    return graphics
  }
}
