import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"

type EndpointRef = {
  traceIndex: number
  atStart: boolean
  point: Point
}

const EPS = 1e-6

const pointsEqual = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS

const dedupeConsecutivePoints = (points: Point[]): Point[] => {
  if (points.length <= 1) return points
  const out: Point[] = [points[0]!]
  for (let i = 1; i < points.length; i++) {
    if (!pointsEqual(points[i]!, out[out.length - 1]!)) out.push(points[i]!)
  }
  return out
}

export class SameNetTraceJoinSolver extends BaseSolver {
  traces: SolvedTracePath[]
  maxJoinDistance: number

  constructor(params: { traces: SolvedTracePath[]; maxJoinDistance?: number }) {
    super()
    this.traces = params.traces.map((t) => ({
      ...t,
      tracePath: [...t.tracePath],
      mspConnectionPairIds: [...t.mspConnectionPairIds],
      pinIds: [...t.pinIds],
    }))
    this.maxJoinDistance = params.maxJoinDistance ?? 0.25
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceJoinSolver
  >[0] {
    return {
      traces: this.traces,
      maxJoinDistance: this.maxJoinDistance,
    }
  }

  private getEndpoints(traceIndex: number): EndpointRef[] {
    const path = this.traces[traceIndex]!.tracePath
    return [
      { traceIndex, atStart: true, point: path[0]! },
      { traceIndex, atStart: false, point: path[path.length - 1]! },
    ]
  }

  private getOrientedPath(endpoint: EndpointRef): Point[] {
    const path = this.traces[endpoint.traceIndex]!.tracePath
    return endpoint.atStart ? [...path] : [...path].reverse()
  }

  private canJoin(a: EndpointRef, b: EndpointRef): boolean {
    const dx = Math.abs(a.point.x - b.point.x)
    const dy = Math.abs(a.point.y - b.point.y)
    const aligned = dx < EPS || dy < EPS
    const manhattan = dx + dy
    return aligned && manhattan > EPS && manhattan <= this.maxJoinDistance
  }

  private joinTraces(a: EndpointRef, b: EndpointRef) {
    const traceA = this.traces[a.traceIndex]!
    const traceB = this.traces[b.traceIndex]!

    const aPath = this.getOrientedPath(a)
    const bPath = this.getOrientedPath(b)

    const bridge = { x: b.point.x, y: b.point.y }
    const joinedPath = dedupeConsecutivePoints(
      pointsEqual(aPath[aPath.length - 1]!, bridge)
        ? [...aPath, ...bPath]
        : [...aPath, bridge, ...bPath],
    )

    traceA.tracePath = joinedPath
    traceA.mspConnectionPairIds = [
      ...traceA.mspConnectionPairIds,
      ...traceB.mspConnectionPairIds,
    ]
    traceA.pinIds = [...traceA.pinIds, ...traceB.pinIds]

    this.traces.splice(b.traceIndex, 1)
  }

  override _step() {
    for (let i = 0; i < this.traces.length; i++) {
      for (let j = i + 1; j < this.traces.length; j++) {
        const a = this.traces[i]!
        const b = this.traces[j]!
        if (a.globalConnNetId !== b.globalConnNetId) continue

        const aEndpoints = this.getEndpoints(i)
        const bEndpoints = this.getEndpoints(j)

        for (const ae of aEndpoints) {
          for (const be of bEndpoints) {
            if (!this.canJoin(ae, be)) continue
            this.joinTraces(ae, be)
            return
          }
        }
      }
    }

    this.solved = true
  }
}
