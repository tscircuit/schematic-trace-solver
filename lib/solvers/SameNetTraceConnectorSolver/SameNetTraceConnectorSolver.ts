import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const DEFAULT_MAX_CONNECT_DISTANCE = 0.2
const EPS = 1e-6

type TraceEndpoint = {
  traceIndex: number
  pointIndex: 0 | "last"
  point: Point
}

const manhattanDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const pointKey = (point: Point) => `${point.x.toFixed(6)},${point.y.toFixed(6)}`

const getEndpoints = (trace: SolvedTracePath, traceIndex: number) => {
  if (trace.tracePath.length === 0) return []
  const first = trace.tracePath[0]!
  const last = trace.tracePath[trace.tracePath.length - 1]!
  if (pointKey(first) === pointKey(last)) {
    return [{ traceIndex, pointIndex: 0 as const, point: first }]
  }
  return [
    { traceIndex, pointIndex: 0 as const, point: first },
    { traceIndex, pointIndex: "last" as const, point: last },
  ]
}

const buildOrthogonalConnectorPath = (from: Point, to: Point): Point[] => {
  if (manhattanDistance(from, to) < EPS) return [from]
  if (Math.abs(from.x - to.x) < EPS || Math.abs(from.y - to.y) < EPS) {
    return [from, to]
  }
  return [from, { x: from.x, y: to.y }, to]
}

class UnionFind {
  parent: number[]

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i)
  }

  find(index: number): number {
    const parent = this.parent[index]!
    if (parent === index) return index
    const root = this.find(parent)
    this.parent[index] = root
    return root
  }

  union(a: number, b: number) {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA === rootB) return false
    this.parent[rootB] = rootA
    return true
  }
}

export class SameNetTraceConnectorSolver extends BaseSolver {
  traces: SolvedTracePath[]
  addedConnectorTraces: SolvedTracePath[] = []
  maxConnectDistance: number

  constructor(
    private params: {
      traces: SolvedTracePath[]
      maxConnectDistance?: number
    },
  ) {
    super()
    this.traces = [...params.traces]
    this.maxConnectDistance =
      params.maxConnectDistance ?? DEFAULT_MAX_CONNECT_DISTANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceConnectorSolver
  >[0] {
    return this.params
  }

  override _step() {
    this.connectCloseSameNetTraceEndpoints()
    this.solved = true
  }

  private connectCloseSameNetTraceEndpoints() {
    const traceIndexesByNet = new Map<string, number[]>()
    for (const [traceIndex, trace] of this.traces.entries()) {
      if (!trace.globalConnNetId) continue
      const existing = traceIndexesByNet.get(trace.globalConnNetId) ?? []
      existing.push(traceIndex)
      traceIndexesByNet.set(trace.globalConnNetId, existing)
    }

    for (const [globalConnNetId, traceIndexes] of traceIndexesByNet) {
      if (traceIndexes.length < 2) continue

      const unionFind = new UnionFind(this.traces.length)
      const candidateBridges: Array<{
        from: TraceEndpoint
        to: TraceEndpoint
        distance: number
      }> = []

      for (let i = 0; i < traceIndexes.length; i++) {
        const traceIndexA = traceIndexes[i]!
        const endpointsA = getEndpoints(this.traces[traceIndexA]!, traceIndexA)

        for (let j = i + 1; j < traceIndexes.length; j++) {
          const traceIndexB = traceIndexes[j]!
          const endpointsB = getEndpoints(
            this.traces[traceIndexB]!,
            traceIndexB,
          )

          for (const from of endpointsA) {
            for (const to of endpointsB) {
              const distance = manhattanDistance(from.point, to.point)
              if (distance <= EPS) {
                unionFind.union(from.traceIndex, to.traceIndex)
                continue
              }
              if (distance > this.maxConnectDistance) continue
              candidateBridges.push({ from, to, distance })
            }
          }
        }
      }

      candidateBridges.sort((a, b) => a.distance - b.distance)

      for (const bridge of candidateBridges) {
        if (!unionFind.union(bridge.from.traceIndex, bridge.to.traceIndex)) {
          continue
        }

        const traceA = this.traces[bridge.from.traceIndex]!
        const traceB = this.traces[bridge.to.traceIndex]!
        const connectorTrace: SolvedTracePath = {
          ...traceA,
          mspPairId: `same-net-connector:${globalConnNetId}:${traceA.mspPairId}:${traceB.mspPairId}`,
          dcConnNetId: traceA.dcConnNetId,
          globalConnNetId,
          userNetId: traceA.userNetId ?? traceB.userNetId,
          pins: [traceA.pins[0], traceB.pins[0]],
          tracePath: buildOrthogonalConnectorPath(
            bridge.from.point,
            bridge.to.point,
          ),
          mspConnectionPairIds: [
            ...new Set([
              ...traceA.mspConnectionPairIds,
              ...traceB.mspConnectionPairIds,
            ]),
          ],
          pinIds: [...new Set([...traceA.pinIds, ...traceB.pinIds])],
        }

        this.addedConnectorTraces.push(connectorTrace)
        this.traces.push(connectorTrace)
      }
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.addedConnectorTraces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: "#ff9900",
        strokeDash: "3 2",
      })),
      points: [],
      rects: [],
      circles: [],
    }
  }

  public getOutput() {
    return {
      traces: this.traces,
      addedConnectorTraces: this.addedConnectorTraces,
    }
  }
}
