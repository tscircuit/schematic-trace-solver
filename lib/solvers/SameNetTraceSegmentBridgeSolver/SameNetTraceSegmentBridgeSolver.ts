import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"

type Orientation = "horizontal" | "vertical"

interface TraceSegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  coord: number
  rangeMin: number
  rangeMax: number
  length: number
  netKey: string
}

interface SameNetTraceSegmentBridgeSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  mergeDistance?: number
  maxPasses?: number
}

const EPSILON = 1e-6

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y }
}

function cloneTrace(trace: SolvedTracePath): SolvedTracePath {
  return {
    ...trace,
    tracePath: trace.tracePath.map(clonePoint),
  }
}

function getNetKey(trace: SolvedTracePath): string {
  return trace.userNetId || trace.globalConnNetId || trace.dcConnNetId
}

function getOrientation(a: Point, b: Point): Orientation | null {
  if (Math.abs(a.y - b.y) < EPSILON && Math.abs(a.x - b.x) > EPSILON) {
    return "horizontal"
  }
  if (Math.abs(a.x - b.x) < EPSILON && Math.abs(a.y - b.y) > EPSILON) {
    return "vertical"
  }
  return null
}

function getSegmentRef(
  trace: SolvedTracePath,
  traceIndex: number,
  segmentIndex: number,
): TraceSegmentRef | null {
  const start = trace.tracePath[segmentIndex]
  const end = trace.tracePath[segmentIndex + 1]
  if (!start || !end) return null

  const orientation = getOrientation(start, end)
  if (!orientation) return null

  const values =
    orientation === "horizontal" ? [start.x, end.x] : [start.y, end.y]
  const coord = orientation === "horizontal" ? start.y : start.x

  return {
    traceIndex,
    segmentIndex,
    orientation,
    coord,
    rangeMin: Math.min(...values),
    rangeMax: Math.max(...values),
    length: Math.abs(values[1]! - values[0]!),
    netKey: getNetKey(trace),
  }
}

function getInternalSegmentRefs(traces: SolvedTracePath[]): TraceSegmentRef[] {
  const refs: TraceSegmentRef[] = []
  traces.forEach((trace, traceIndex) => {
    for (
      let segmentIndex = 1;
      segmentIndex < trace.tracePath.length - 2;
      segmentIndex++
    ) {
      const ref = getSegmentRef(trace, traceIndex, segmentIndex)
      if (ref) refs.push(ref)
    }
  })
  return refs
}

function projectionOverlap(a: TraceSegmentRef, b: TraceSegmentRef): number {
  return Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin)
}

function canBridge(
  a: TraceSegmentRef,
  b: TraceSegmentRef,
  mergeDistance: number,
) {
  if (
    a.traceIndex === b.traceIndex &&
    Math.abs(a.segmentIndex - b.segmentIndex) <= 1
  ) {
    return false
  }
  if (a.netKey !== b.netKey) return false
  if (a.orientation !== b.orientation) return false
  if (Math.abs(a.coord - b.coord) > mergeDistance) return false
  if (projectionOverlap(a, b) <= EPSILON) return false
  return true
}

function selectMovingSegment(a: TraceSegmentRef, b: TraceSegmentRef) {
  if (a.length !== b.length) {
    return a.length < b.length
      ? { moving: a, target: b }
      : { moving: b, target: a }
  }
  if (a.coord !== b.coord) {
    return a.coord > b.coord
      ? { moving: a, target: b }
      : { moving: b, target: a }
  }
  return `${a.traceIndex}:${a.segmentIndex}` >
    `${b.traceIndex}:${b.segmentIndex}`
    ? { moving: a, target: b }
    : { moving: b, target: a }
}

function removeConsecutiveDuplicatePoints(points: Point[]) {
  return points.filter((point, index) => {
    const previous = points[index - 1]
    return (
      !previous ||
      Math.abs(point.x - previous.x) > EPSILON ||
      Math.abs(point.y - previous.y) > EPSILON
    )
  })
}

function applyBridge(
  traces: SolvedTracePath[],
  moving: TraceSegmentRef,
  targetCoord: number,
) {
  const output = traces.map(cloneTrace)
  const trace = output[moving.traceIndex]!
  const path = trace.tracePath.map(clonePoint)
  const start = path[moving.segmentIndex]!
  const end = path[moving.segmentIndex + 1]!

  if (moving.orientation === "horizontal") {
    path[moving.segmentIndex] = { ...start, y: targetCoord }
    path[moving.segmentIndex + 1] = { ...end, y: targetCoord }
  } else {
    path[moving.segmentIndex] = { ...start, x: targetCoord }
    path[moving.segmentIndex + 1] = { ...end, x: targetCoord }
  }

  trace.tracePath = removeConsecutiveDuplicatePoints(path)
  return output
}

function countPointsChanged(before: Point[], after: Point[]) {
  const maxLength = Math.max(before.length, after.length)
  let changed = 0
  for (let index = 0; index < maxLength; index++) {
    const a = before[index]
    const b = after[index]
    if (
      !a ||
      !b ||
      Math.abs(a.x - b.x) > EPSILON ||
      Math.abs(a.y - b.y) > EPSILON
    ) {
      changed++
    }
  }
  return changed
}

export class SameNetTraceSegmentBridgeSolver extends BaseSolver {
  private input: SameNetTraceSegmentBridgeSolverInput
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceSegmentBridgeSolverInput) {
    super()
    this.input = input
    this.outputTraces = input.traces.map(cloneTrace)
    this.MAX_ITERATIONS = 1
  }

  override _step() {
    const mergeDistance = this.input.mergeDistance ?? 0.12
    const maxPasses = this.input.maxPasses ?? 12
    let bridgeCount = 0

    for (let pass = 0; pass < maxPasses; pass++) {
      const refs = getInternalSegmentRefs(this.outputTraces)
      let bridgeApplied = false

      for (let i = 0; i < refs.length; i++) {
        for (let j = i + 1; j < refs.length; j++) {
          const first = refs[i]!
          const second = refs[j]!
          if (!canBridge(first, second, mergeDistance)) continue

          const { moving, target } = selectMovingSegment(first, second)
          const before = this.outputTraces[moving.traceIndex]!.tracePath
          const candidate = applyBridge(this.outputTraces, moving, target.coord)
          const after = candidate[moving.traceIndex]!.tracePath
          if (countPointsChanged(before, after) === 0) continue

          this.outputTraces = candidate
          bridgeCount++
          bridgeApplied = true
          break
        }
        if (bridgeApplied) break
      }

      if (!bridgeApplied) break
    }

    this.stats.bridgeCount = bridgeCount
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
      bridgeCount: this.stats.bridgeCount ?? 0,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.input.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    if (!graphics.lines) graphics.lines = []

    for (const trace of this.outputTraces) {
      const line: Line = {
        points: trace.tracePath.map((point) => ({ x: point.x, y: point.y })),
        strokeColor: "purple",
      }
      graphics.lines.push(line)
    }

    return graphics
  }
}
