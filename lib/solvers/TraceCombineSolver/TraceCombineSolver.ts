import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"
import type { Point } from "@tscircuit/math-utils"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"

type Orientation = "horizontal" | "vertical"

interface TraceCombineSolverParams {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  distanceThreshold?: number
}

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  coord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6

const cloneTrace = (trace: SolvedTracePath): SolvedTracePath => ({
  ...trace,
  tracePath: trace.tracePath.map((p) => ({ ...p })),
})

const getSegmentRef = (
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): SegmentRef | null => {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return null

  if (Math.abs(start.y - end.y) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "horizontal",
      coord: start.y,
      min: Math.min(start.x, end.x),
      max: Math.max(start.x, end.x),
      length: Math.abs(start.x - end.x),
    }
  }

  if (Math.abs(start.x - end.x) < EPS) {
    return {
      traceIndex,
      segmentIndex,
      orientation: "vertical",
      coord: start.x,
      min: Math.min(start.y, end.y),
      max: Math.max(start.y, end.y),
      length: Math.abs(start.y - end.y),
    }
  }

  return null
}

const isInternalSegment = (path: Point[], segmentIndex: number) =>
  segmentIndex > 0 && segmentIndex < path.length - 2

const rangesTouchOrOverlap = (
  a: SegmentRef,
  b: SegmentRef,
  threshold: number,
) => Math.max(a.min, b.min) <= Math.min(a.max, b.max) + threshold

const areSegmentsCombinable = (
  a: SegmentRef,
  b: SegmentRef,
  threshold: number,
) =>
  a.orientation === b.orientation &&
  Math.abs(a.coord - b.coord) <= threshold &&
  rangesTouchOrOverlap(a, b, threshold)

const targetCoordFor = (a: SegmentRef, b: SegmentRef) => {
  if (a.length !== b.length) return a.length > b.length ? a.coord : b.coord
  return Math.min(a.coord, b.coord)
}

const snapSegmentCoord = (
  path: Point[],
  segment: SegmentRef,
  coord: number,
) => {
  const start = path[segment.segmentIndex]!
  const end = path[segment.segmentIndex + 1]!

  if (segment.orientation === "horizontal") {
    start.y = coord
    end.y = coord
  } else {
    start.x = coord
    end.x = coord
  }
}

/**
 * Combines close same-net trace trunks by snapping internal parallel segments
 * onto a shared coordinate. Terminal segments are left untouched so pin
 * endpoints remain fixed.
 */
export class TraceCombineSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraces: SolvedTracePath[]
  distanceThreshold: number

  outputTraces: SolvedTracePath[]
  combinedSegmentCount = 0

  constructor(params: TraceCombineSolverParams) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraces = params.inputTraces
    this.distanceThreshold = params.distanceThreshold ?? 0.1
    this.outputTraces = this.inputTraces.map(cloneTrace)
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceCombineSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraces: this.inputTraces,
      distanceThreshold: this.distanceThreshold,
    }
  }

  override _step() {
    const tracesByNet = new Map<string, number[]>()
    for (let i = 0; i < this.outputTraces.length; i++) {
      const netId = this.outputTraces[i]!.globalConnNetId
      if (!tracesByNet.has(netId)) tracesByNet.set(netId, [])
      tracesByNet.get(netId)!.push(i)
    }

    for (const traceIndexes of tracesByNet.values()) {
      this.combineTraceGroup(traceIndexes)
    }

    for (const trace of this.outputTraces) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }

    this.stats.combinedSegmentCount = this.combinedSegmentCount
    this.solved = true
  }

  private combineTraceGroup(traceIndexes: number[]) {
    const segments: SegmentRef[] = []

    for (const traceIndex of traceIndexes) {
      const trace = this.outputTraces[traceIndex]!
      for (
        let segmentIndex = 0;
        segmentIndex < trace.tracePath.length - 1;
        segmentIndex++
      ) {
        if (!isInternalSegment(trace.tracePath, segmentIndex)) continue
        const segment = getSegmentRef(trace, traceIndex, segmentIndex)
        if (segment && segment.length > EPS) segments.push(segment)
      }
    }

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!
        if (a.traceIndex === b.traceIndex) continue
        if (!areSegmentsCombinable(a, b, this.distanceThreshold)) continue

        const targetCoord = targetCoordFor(a, b)
        const traceA = this.outputTraces[a.traceIndex]!
        const traceB = this.outputTraces[b.traceIndex]!
        let changed = false

        if (Math.abs(a.coord - targetCoord) > EPS) {
          snapSegmentCoord(traceA.tracePath, a, targetCoord)
          a.coord = targetCoord
          changed = true
        }

        if (Math.abs(b.coord - targetCoord) > EPS) {
          snapSegmentCoord(traceB.tracePath, b, targetCoord)
          b.coord = targetCoord
          changed = true
        }

        if (changed) this.combinedSegmentCount++
      }
    }
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
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
