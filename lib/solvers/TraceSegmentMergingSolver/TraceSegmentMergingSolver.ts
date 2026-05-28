import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject, Line } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

interface TraceSegmentMergingSolverInput {
  traces: SolvedTracePath[]
  maxEndpointDistance?: number
}

type EndpointName = "start" | "end"

interface ClosestEndpointPair {
  firstEndpoint: EndpointName
  secondEndpoint: EndpointName
  distance: number
}

const DEFAULT_MAX_ENDPOINT_DISTANCE = 0.15
const SAME_POINT_EPSILON = 1e-6

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const endpoint = (path: Point[], name: EndpointName) =>
  name === "start" ? path[0]! : path[path.length - 1]!

const reverseIfNeeded = (path: Point[], endpointToConnect: EndpointName) =>
  endpointToConnect === "end" ? [...path] : [...path].reverse()

const appendPoint = (path: Point[], point: Point) => {
  const last = path[path.length - 1]
  if (last && distance(last, point) <= SAME_POINT_EPSILON) return
  path.push(point)
}

const getClosestEndpointPair = (
  first: SolvedTracePath,
  second: SolvedTracePath,
): ClosestEndpointPair => {
  const candidates: ClosestEndpointPair[] = [
    {
      firstEndpoint: "start",
      secondEndpoint: "start",
      distance: distance(
        endpoint(first.tracePath, "start"),
        endpoint(second.tracePath, "start"),
      ),
    },
    {
      firstEndpoint: "start",
      secondEndpoint: "end",
      distance: distance(
        endpoint(first.tracePath, "start"),
        endpoint(second.tracePath, "end"),
      ),
    },
    {
      firstEndpoint: "end",
      secondEndpoint: "start",
      distance: distance(
        endpoint(first.tracePath, "end"),
        endpoint(second.tracePath, "start"),
      ),
    },
    {
      firstEndpoint: "end",
      secondEndpoint: "end",
      distance: distance(
        endpoint(first.tracePath, "end"),
        endpoint(second.tracePath, "end"),
      ),
    },
  ]

  return candidates.sort((a, b) => a.distance - b.distance)[0]!
}

const mergeTracePair = (
  first: SolvedTracePath,
  second: SolvedTracePath,
  closestEndpoints: ClosestEndpointPair,
): SolvedTracePath => {
  const firstPath = reverseIfNeeded(
    first.tracePath,
    closestEndpoints.firstEndpoint,
  )
  const secondPath =
    closestEndpoints.secondEndpoint === "start"
      ? [...second.tracePath]
      : [...second.tracePath].reverse()

  const tracePath: Point[] = []
  for (const point of firstPath) appendPoint(tracePath, point)
  for (const point of secondPath) appendPoint(tracePath, point)

  return {
    ...first,
    mspPairId: `${first.mspPairId}+${second.mspPairId}`,
    pins: [
      firstPath[0] === first.tracePath[0] ? first.pins[0] : first.pins[1],
      secondPath.at(-1) === second.tracePath.at(-1)
        ? second.pins[1]
        : second.pins[0],
    ],
    tracePath,
    mspConnectionPairIds: [
      ...first.mspConnectionPairIds,
      ...second.mspConnectionPairIds,
    ],
    pinIds: Array.from(new Set([...first.pinIds, ...second.pinIds])),
  }
}

export class TraceSegmentMergingSolver extends BaseSolver {
  private traces: SolvedTracePath[]
  private maxEndpointDistance: number

  constructor(params: TraceSegmentMergingSolverInput) {
    super()
    this.traces = [...params.traces]
    this.maxEndpointDistance =
      params.maxEndpointDistance ?? DEFAULT_MAX_ENDPOINT_DISTANCE
  }

  override getConstructorParams(): ConstructorParameters<
    typeof TraceSegmentMergingSolver
  >[0] {
    return {
      traces: this.traces,
      maxEndpointDistance: this.maxEndpointDistance,
    }
  }

  override _step() {
    for (let i = 0; i < this.traces.length; i++) {
      for (let j = i + 1; j < this.traces.length; j++) {
        const first = this.traces[i]!
        const second = this.traces[j]!
        if (first.globalConnNetId !== second.globalConnNetId) continue

        const closestEndpoints = getClosestEndpointPair(first, second)
        if (closestEndpoints.distance > this.maxEndpointDistance) continue

        this.traces.splice(j, 1)
        this.traces[i] = mergeTracePair(first, second, closestEndpoints)
        return
      }
    }

    this.solved = true
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
          strokeColor: "purple",
        }),
      ),
      points: [],
      rects: [],
      circles: [],
    }
  }
}
