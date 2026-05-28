import type { GraphicsObject, Line, Point } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface SameNetTraceMergeSolverInput {
  traces: SolvedTracePath[]
  mergeDistance?: number
}

type Segment = {
  traceIndex: number
  startIndex: number
  endIndex: number
  orientation: "horizontal" | "vertical"
  fixedCoord: number
  min: number
  max: number
  length: number
  netId: string
}

const DEFAULT_MERGE_DISTANCE = 0.1
const EPSILON = 1e-9

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getSegmentOrientation = (a: Point, b: Point) => {
  if (Math.abs(a.y - b.y) < EPSILON && Math.abs(a.x - b.x) > EPSILON) {
    return "horizontal" as const
  }
  if (Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) > EPSILON) {
    return "vertical" as const
  }
  return null
}

const intervalsOverlap = (a: Segment, b: Segment) =>
  Math.max(a.min, b.min) <= Math.min(a.max, b.max) + EPSILON

const setSegmentFixedCoord = (
  traces: SolvedTracePath[],
  segment: Segment,
  coord: number,
) => {
  const path = traces[segment.traceIndex]!.tracePath
  const a = path[segment.startIndex]!
  const b = path[segment.endIndex]!

  if (segment.orientation === "horizontal") {
    a.y = coord
    b.y = coord
  } else {
    a.x = coord
    b.x = coord
  }
}

const collectMergeableSegments = (traces: SolvedTracePath[]) => {
  const segments: Segment[] = []

  for (const [traceIndex, trace] of traces.entries()) {
    const netId = getTraceNetId(trace)
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      if (i === 0 || i + 1 === trace.tracePath.length - 1) continue

      const start = trace.tracePath[i]!
      const end = trace.tracePath[i + 1]!
      const orientation = getSegmentOrientation(start, end)
      if (!orientation) continue

      const values =
        orientation === "horizontal" ? [start.x, end.x] : [start.y, end.y]
      const fixedCoord = orientation === "horizontal" ? start.y : start.x
      const min = Math.min(...values)
      const max = Math.max(...values)

      segments.push({
        traceIndex,
        startIndex: i,
        endIndex: i + 1,
        orientation,
        fixedCoord,
        min,
        max,
        length: max - min,
        netId,
      })
    }
  }

  return segments
}

export const mergeCloseSameNetTraceSegments = ({
  traces,
  mergeDistance = DEFAULT_MERGE_DISTANCE,
}: SameNetTraceMergeSolverInput): SolvedTracePath[] => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))
  const segments = collectMergeableSegments(outputTraces)

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]!
      const b = segments[j]!
      if (a.traceIndex === b.traceIndex) continue
      if (a.netId !== b.netId) continue
      if (a.orientation !== b.orientation) continue
      if (!intervalsOverlap(a, b)) continue
      if (Math.abs(a.fixedCoord - b.fixedCoord) > mergeDistance) continue

      const targetCoord = a.length >= b.length ? a.fixedCoord : b.fixedCoord
      setSegmentFixedCoord(outputTraces, a, targetCoord)
      setSegmentFixedCoord(outputTraces, b, targetCoord)
      a.fixedCoord = targetCoord
      b.fixedCoord = targetCoord
    }
  }

  return outputTraces
}

export class SameNetTraceMergeSolver extends BaseSolver {
  private input: SameNetTraceMergeSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceMergeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces
  }

  override _step() {
    this.outputTraces = mergeCloseSameNetTraceSegments(this.input)
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const lines: Line[] = this.outputTraces.map((trace) => ({
      points: trace.tracePath,
      strokeColor: "blue",
    }))
    return { lines }
  }
}
