import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { getColorFromString } from "lib/utils/getColorFromString"
import { BaseSolver } from "../BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const DEFAULT_MERGE_DISTANCE = 0.12
const EPS = 1e-6

type Orientation = "horizontal" | "vertical"

type SegmentLocator = {
  traceIndex: number
  segmentIndex: number
  trace: SolvedTracePath
  orientation: Orientation
  constant: number
  min: number
  max: number
  length: number
  canMove: boolean
}

interface SameNetTraceMergingSolverParams {
  allTraces: SolvedTracePath[]
  mergeDistance?: number
}

const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  pins: [{ ...trace.pins[0] }, { ...trace.pins[1] }],
  tracePath: trace.tracePath.map((p) => ({ ...p })),
  mspConnectionPairIds: [...trace.mspConnectionPairIds],
  pinIds: [...trace.pinIds],
})

const isTracePinPoint = (trace: SolvedTracePath, point: Point) =>
  trace.pins.some((pin) => samePoint(pin, point))

const getSegmentLocator = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentLocator | null => {
  const a = trace.tracePath[segmentIndex]
  const b = trace.tracePath[segmentIndex + 1]
  if (!a || !b) return null

  const isHorizontal = Math.abs(a.y - b.y) < EPS
  const isVertical = Math.abs(a.x - b.x) < EPS
  if (!isHorizontal && !isVertical) return null

  const orientation: Orientation = isHorizontal ? "horizontal" : "vertical"
  const min = isHorizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
  const max = isHorizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)

  return {
    traceIndex,
    segmentIndex,
    trace,
    orientation,
    constant: isHorizontal ? a.y : a.x,
    min,
    max,
    length: max - min,
    canMove: !isTracePinPoint(trace, a) && !isTracePinPoint(trace, b),
  }
}

const simplifyPath = (path: Point[]) => {
  const deduped: Point[] = []
  for (const point of path) {
    if (!deduped.at(-1) || !samePoint(deduped.at(-1)!, point)) {
      deduped.push(point)
    }
  }

  const simplified: Point[] = []
  for (const point of deduped) {
    simplified.push(point)
    while (simplified.length >= 3) {
      const a = simplified[simplified.length - 3]!
      const b = simplified[simplified.length - 2]!
      const c = simplified[simplified.length - 1]!
      const colinearHorizontal =
        Math.abs(a.y - b.y) < EPS && Math.abs(b.y - c.y) < EPS
      const colinearVertical =
        Math.abs(a.x - b.x) < EPS && Math.abs(b.x - c.x) < EPS
      if (!colinearHorizontal && !colinearVertical) break
      simplified.splice(simplified.length - 2, 1)
    }
  }

  return simplified
}

export class SameNetTraceMergingSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private mergeDistance: number

  constructor(params: SameNetTraceMergingSolverParams) {
    super()
    this.traces = params.allTraces.map(cloneTrace)
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceMergingSolver
  >[0] {
    return {
      allTraces: this.traces,
      mergeDistance: this.mergeDistance,
    }
  }

  private getSegments() {
    const segments: SegmentLocator[] = []
    for (let traceIndex = 0; traceIndex < this.traces.length; traceIndex++) {
      const trace = this.traces[traceIndex]!
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        const segment = getSegmentLocator(trace, traceIndex, segmentIndex)
        if (segment) segments.push(segment)
      }
    }
    return segments
  }

  private findNextMergeCandidate() {
    const segments = this.getSegments()
    for (let i = 0; i < segments.length; i++) {
      const a = segments[i]!
      for (let j = i + 1; j < segments.length; j++) {
        const b = segments[j]!
        if (a.trace.globalConnNetId !== b.trace.globalConnNetId) continue
        if (a.orientation !== b.orientation) continue
        if (Math.abs(a.constant - b.constant) < EPS) continue
        if (Math.abs(a.constant - b.constant) > this.mergeDistance) continue

        const overlap = Math.min(a.max, b.max) - Math.max(a.min, b.min)
        if (overlap <= EPS) continue

        const source =
          a.canMove && b.canMove
            ? a.length <= b.length
              ? a
              : b
            : a.canMove
              ? a
              : b.canMove
                ? b
                : null
        if (!source) continue

        const target = source === a ? b : a
        return { source, target }
      }
    }

    return null
  }

  override _step() {
    const candidate = this.findNextMergeCandidate()
    if (!candidate) {
      this.solved = true
      return
    }

    const { source, target } = candidate
    const trace = this.traces[source.traceIndex]!
    const first = trace.tracePath[source.segmentIndex]!
    const second = trace.tracePath[source.segmentIndex + 1]!

    if (source.orientation === "horizontal") {
      first.y = target.constant
      second.y = target.constant
    } else {
      first.x = target.constant
      second.x = target.constant
    }

    trace.tracePath = simplifyPath(trace.tracePath)
    this.stats.mergedSegments = (this.stats.mergedSegments ?? 0) + 1
  }

  getOutput() {
    return {
      traces: this.traces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.traces.map(
        (trace): Line => ({
          points: trace.tracePath,
          strokeColor: getColorFromString(trace.globalConnNetId),
        }),
      ),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
