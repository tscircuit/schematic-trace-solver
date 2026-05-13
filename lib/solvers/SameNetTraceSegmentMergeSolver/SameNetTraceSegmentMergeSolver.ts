import type { Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export interface SameNetTraceSegmentMergeSolverInput {
  traces: SolvedTracePath[]
  /** Maximum Manhattan distance between same-net trace endpoints to bridge. */
  maxEndpointGap?: number
}

type OrientedJoin = {
  leftIndex: number
  rightIndex: number
  leftPath: Point[]
  rightPath: Point[]
  distance: number
}

const DEFAULT_MAX_ENDPOINT_GAP = 0.12
const EPS = 1e-9

const samePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const manhattan = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const clonePoint = (p: Point): Point => ({ x: p.x, y: p.y })

const dedupeConsecutivePoints = (points: Point[]): Point[] => {
  const result: Point[] = []
  for (const point of points) {
    if (result.length === 0 || !samePoint(result[result.length - 1]!, point)) {
      result.push(clonePoint(point))
    }
  }
  return result
}

const simplifyCollinearPoints = (points: Point[]): Point[] => {
  const path = dedupeConsecutivePoints(points)
  if (path.length <= 2) return path

  const simplified: Point[] = [path[0]!]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = simplified[simplified.length - 1]!
    const current = path[i]!
    const next = path[i + 1]!
    const horizontal =
      Math.abs(prev.y - current.y) < EPS && Math.abs(current.y - next.y) < EPS
    const vertical =
      Math.abs(prev.x - current.x) < EPS && Math.abs(current.x - next.x) < EPS
    if (!horizontal && !vertical) simplified.push(current)
  }
  simplified.push(path[path.length - 1]!)
  return simplified
}

const orthogonalBridge = (from: Point, to: Point): Point[] => {
  if (samePoint(from, to)) return []
  if (Math.abs(from.x - to.x) < EPS || Math.abs(from.y - to.y) < EPS) {
    return [clonePoint(to)]
  }
  return [{ x: to.x, y: from.y }, clonePoint(to)]
}

const getNetKey = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const getOrientations = (path: Point[]) => [path, [...path].reverse()]

const findBestJoin = (
  traces: SolvedTracePath[],
  maxEndpointGap: number,
): OrientedJoin | null => {
  let best: OrientedJoin | null = null

  for (let i = 0; i < traces.length; i++) {
    for (let j = i + 1; j < traces.length; j++) {
      if (getNetKey(traces[i]!) !== getNetKey(traces[j]!)) continue

      for (const leftPath of getOrientations(traces[i]!.tracePath)) {
        for (const rightPath of getOrientations(traces[j]!.tracePath)) {
          const distance = manhattan(
            leftPath[leftPath.length - 1]!,
            rightPath[0]!,
          )
          if (
            distance <= maxEndpointGap &&
            (!best || distance < best.distance)
          ) {
            best = {
              leftIndex: i,
              rightIndex: j,
              leftPath,
              rightPath,
              distance,
            }
          }
        }
      }
    }
  }

  return best
}

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  private input: Required<SameNetTraceSegmentMergeSolverInput>
  outputTraces: SolvedTracePath[]

  constructor(input: SameNetTraceSegmentMergeSolverInput) {
    super()
    this.input = {
      ...input,
      maxEndpointGap: input.maxEndpointGap ?? DEFAULT_MAX_ENDPOINT_GAP,
    }
    this.outputTraces = input.traces.map((trace) => ({
      ...trace,
      tracePath: trace.tracePath.map(clonePoint),
      mspConnectionPairIds: [...trace.mspConnectionPairIds],
      pinIds: [...trace.pinIds],
    }))
  }

  override _step() {
    const join = findBestJoin(this.outputTraces, this.input.maxEndpointGap)
    if (!join) {
      this.solved = true
      return
    }

    const left = this.outputTraces[join.leftIndex]!
    const right = this.outputTraces[join.rightIndex]!
    const bridge = orthogonalBridge(
      join.leftPath[join.leftPath.length - 1]!,
      join.rightPath[0]!,
    )

    const mergedTrace: SolvedTracePath = {
      ...left,
      tracePath: simplifyCollinearPoints([
        ...join.leftPath,
        ...bridge,
        ...join.rightPath,
      ]),
      mspConnectionPairIds: [
        ...left.mspConnectionPairIds,
        ...right.mspConnectionPairIds.filter(
          (id) => !left.mspConnectionPairIds.includes(id),
        ),
      ],
      pinIds: [
        ...left.pinIds,
        ...right.pinIds.filter((id) => !left.pinIds.includes(id)),
      ],
    }

    this.outputTraces = this.outputTraces.filter(
      (_, index) => index !== join.leftIndex && index !== join.rightIndex,
    )
    this.outputTraces.push(mergedTrace)
  }

  getOutput() {
    return { traces: this.outputTraces }
  }
}
