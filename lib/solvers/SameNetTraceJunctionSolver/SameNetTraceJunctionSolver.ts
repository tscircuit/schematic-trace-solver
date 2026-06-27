import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { GraphicsObject, Line } from "graphics-debug"

interface SameNetTraceJunctionSolverInput {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  snapThreshold?: number
}

const DEFAULT_SNAP_THRESHOLD = 0.05
const EPSILON = 1e-9

const pointsEqual = (a: Point, b: Point, tolerance = EPSILON) =>
  Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const isPointOnAxisAlignedSegment = (
  point: Point,
  start: Point,
  end: Point,
  tolerance = EPSILON,
) => {
  const minX = Math.min(start.x, end.x) - tolerance
  const maxX = Math.max(start.x, end.x) + tolerance
  const minY = Math.min(start.y, end.y) - tolerance
  const maxY = Math.max(start.y, end.y) + tolerance

  if (Math.abs(start.x - end.x) <= tolerance) {
    return (
      Math.abs(point.x - start.x) <= tolerance &&
      point.y >= minY &&
      point.y <= maxY
    )
  }

  if (Math.abs(start.y - end.y) <= tolerance) {
    return (
      Math.abs(point.y - start.y) <= tolerance &&
      point.x >= minX &&
      point.x <= maxX
    )
  }

  return false
}

const projectPointToAxisAlignedSegment = (
  point: Point,
  start: Point,
  end: Point,
): Point | null => {
  if (Math.abs(start.x - end.x) <= EPSILON) {
    const minY = Math.min(start.y, end.y)
    const maxY = Math.max(start.y, end.y)
    const y = Math.min(Math.max(point.y, minY), maxY)
    return { x: start.x, y }
  }

  if (Math.abs(start.y - end.y) <= EPSILON) {
    const minX = Math.min(start.x, end.x)
    const maxX = Math.max(start.x, end.x)
    const x = Math.min(Math.max(point.x, minX), maxX)
    return { x, y: start.y }
  }

  return null
}

const withConsecutiveDuplicatePointsRemoved = (path: Point[]) => {
  const nextPath: Point[] = []

  for (const point of path) {
    if (
      nextPath.length === 0 ||
      !pointsEqual(nextPath[nextPath.length - 1]!, point)
    ) {
      nextPath.push(point)
    }
  }

  return nextPath
}

export class SameNetTraceJunctionSolver extends BaseSolver {
  private inputProblem: InputProblem
  private snapThreshold: number
  traces: SolvedTracePath[]

  constructor(params: SameNetTraceJunctionSolverInput) {
    super()
    this.inputProblem = params.inputProblem
    this.traces = params.traces.map((trace) => ({
      ...trace,
      tracePath: withConsecutiveDuplicatePointsRemoved(trace.tracePath),
    }))
    this.snapThreshold = params.snapThreshold ?? DEFAULT_SNAP_THRESHOLD
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceJunctionSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      traces: this.traces,
      snapThreshold: this.snapThreshold,
    }
  }

  override _step() {
    let changed = false

    for (let sourceIndex = 0; sourceIndex < this.traces.length; sourceIndex++) {
      const sourceTrace = this.traces[sourceIndex]!

      for (const endpointIndex of [0, sourceTrace.tracePath.length - 1]) {
        const endpoint = sourceTrace.tracePath[endpointIndex]!
        const bestJunction = this.findBestJunction(sourceIndex, endpoint)

        if (!bestJunction) continue

        const updatedSourcePath = [...sourceTrace.tracePath]
        updatedSourcePath[endpointIndex] = bestJunction.point
        this.traces[sourceIndex] = {
          ...sourceTrace,
          tracePath: withConsecutiveDuplicatePointsRemoved(updatedSourcePath),
        }

        const targetTrace = this.traces[bestJunction.traceIndex]!
        const updatedTargetPath = [...targetTrace.tracePath]
        const insertIndex = bestJunction.segmentIndex + 1

        if (
          !pointsEqual(
            updatedTargetPath[bestJunction.segmentIndex]!,
            bestJunction.point,
          ) &&
          !pointsEqual(updatedTargetPath[insertIndex]!, bestJunction.point)
        ) {
          updatedTargetPath.splice(insertIndex, 0, bestJunction.point)
          this.traces[bestJunction.traceIndex] = {
            ...targetTrace,
            tracePath: withConsecutiveDuplicatePointsRemoved(updatedTargetPath),
          }
        }

        changed = true
      }
    }

    this.solved = true
    if (!changed) {
      this.traces = this.traces.map((trace) => ({
        ...trace,
        tracePath: withConsecutiveDuplicatePointsRemoved(trace.tracePath),
      }))
    }
  }

  private findBestJunction(sourceIndex: number, endpoint: Point) {
    const sourceTrace = this.traces[sourceIndex]!
    let best: {
      traceIndex: number
      segmentIndex: number
      point: Point
      distance: number
    } | null = null

    for (let traceIndex = 0; traceIndex < this.traces.length; traceIndex++) {
      if (traceIndex === sourceIndex) continue

      const candidateTrace = this.traces[traceIndex]!
      if (candidateTrace.globalConnNetId !== sourceTrace.globalConnNetId)
        continue

      for (
        let segmentIndex = 0;
        segmentIndex < candidateTrace.tracePath.length - 1;
        segmentIndex++
      ) {
        const start = candidateTrace.tracePath[segmentIndex]!
        const end = candidateTrace.tracePath[segmentIndex + 1]!
        const projected = projectPointToAxisAlignedSegment(endpoint, start, end)

        if (!projected) continue
        if (!isPointOnAxisAlignedSegment(projected, start, end)) continue

        const projectedDistance = distance(endpoint, projected)
        if (projectedDistance > this.snapThreshold) continue
        if (pointsEqual(endpoint, projected)) continue

        if (!best || projectedDistance < best.distance) {
          best = {
            traceIndex,
            segmentIndex,
            point: projected,
            distance: projectedDistance,
          }
        }
      }
    }

    return best
  }

  getOutput() {
    return {
      traces: this.traces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem, {
      chipAlpha: 0.1,
      connectionAlpha: 0.1,
    })

    graphics.lines ??= []

    for (const trace of this.traces) {
      const line: Line = {
        points: trace.tracePath,
        strokeColor: "blue",
      }
      graphics.lines.push(line)
    }

    return graphics
  }
}
