import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { getColorFromString } from "lib/utils/getColorFromString"

export const DEFAULT_NEARBY_TRACE_MERGE_DISTANCE = 0.15

interface NearbyTraceMergeSolverParams {
  traces: SolvedTracePath[]
  maxMergeDistance?: number
}

const distanceBetween = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

const areSamePoint = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9

const unique = <T>(values: T[]) => Array.from(new Set(values))

const dedupeConsecutivePoints = (points: Point[]) => {
  const deduped: Point[] = []
  for (const point of points) {
    const last = deduped[deduped.length - 1]
    if (!last || !areSamePoint(last, point)) {
      deduped.push(point)
    }
  }
  return deduped
}

const getOrthogonalConnector = (from: Point, to: Point): Point[] => {
  if (areSamePoint(from, to)) return []
  if (Math.abs(from.x - to.x) < 1e-9 || Math.abs(from.y - to.y) < 1e-9) {
    return [to]
  }
  return [{ x: from.x, y: to.y }, to]
}

const tryJoinPaths = (
  left: Point[],
  right: Point[],
  maxMergeDistance: number,
): { distance: number; tracePath: Point[] } | null => {
  const from = left[left.length - 1]!
  const to = right[0]!
  const distance = distanceBetween(from, to)
  if (distance > maxMergeDistance) return null

  const tracePath = simplifyPath(
    dedupeConsecutivePoints([
      ...left,
      ...getOrthogonalConnector(from, to),
      ...right.slice(1),
    ]),
  )

  return { distance, tracePath }
}

const getBestMergedPath = (
  currentPath: Point[],
  candidatePath: Point[],
  maxMergeDistance: number,
) => {
  const reversedCandidate = [...candidatePath].reverse()

  const options = [
    tryJoinPaths(currentPath, candidatePath, maxMergeDistance),
    tryJoinPaths(currentPath, reversedCandidate, maxMergeDistance),
    tryJoinPaths(candidatePath, currentPath, maxMergeDistance),
    tryJoinPaths(reversedCandidate, currentPath, maxMergeDistance),
  ].filter((option): option is NonNullable<typeof option> => !!option)

  options.sort((a, b) => a.distance - b.distance)
  return options[0]?.tracePath ?? null
}

const getTraceMspPairIds = (trace: SolvedTracePath) =>
  trace.mspConnectionPairIds?.length
    ? trace.mspConnectionPairIds
    : [trace.mspPairId]

const getTracePinIds = (trace: SolvedTracePath) =>
  trace.pinIds?.length
    ? trace.pinIds
    : [trace.pins[0].pinId, trace.pins[1].pinId]

const combineTraceMetadata = (
  a: SolvedTracePath,
  b: SolvedTracePath,
  tracePath: Point[],
): SolvedTracePath => {
  const mspConnectionPairIds = unique([
    ...getTraceMspPairIds(a),
    ...getTraceMspPairIds(b),
  ])
  const pinIds = unique([...getTracePinIds(a), ...getTracePinIds(b)])
  const pinsById = new Map(
    [...a.pins, ...b.pins].map((pin) => [pin.pinId, pin] as const),
  )
  const pins = pinIds.flatMap((pinId) => {
    const pin = pinsById.get(pinId)
    return pin ? [pin] : []
  })

  return {
    ...a,
    mspPairId: `merged-${a.globalConnNetId}-${mspConnectionPairIds.join("--")}`,
    userNetId: a.userNetId ?? b.userNetId,
    tracePath,
    mspConnectionPairIds,
    pinIds,
    pins: [pins[0] ?? a.pins[0], pins[pins.length - 1] ?? b.pins[1]],
  }
}

export class NearbyTraceMergeSolver extends BaseSolver {
  private inputTraces: SolvedTracePath[]
  private maxMergeDistance: number
  private outputTraces: SolvedTracePath[]

  constructor(params: NearbyTraceMergeSolverParams) {
    super()
    this.inputTraces = params.traces
    this.maxMergeDistance =
      params.maxMergeDistance ?? DEFAULT_NEARBY_TRACE_MERGE_DISTANCE
    this.outputTraces = params.traces
  }

  override getConstructorParams(): ConstructorParameters<
    typeof NearbyTraceMergeSolver
  >[0] {
    return {
      traces: this.inputTraces,
      maxMergeDistance: this.maxMergeDistance,
    }
  }

  override _step() {
    const tracesByNet = new Map<string, SolvedTracePath[]>()
    for (const trace of this.inputTraces) {
      const traces = tracesByNet.get(trace.globalConnNetId) ?? []
      traces.push(trace)
      tracesByNet.set(trace.globalConnNetId, traces)
    }

    this.outputTraces = Array.from(tracesByNet.values()).flatMap((traces) =>
      this.mergeTraceGroup(traces),
    )
    this.solved = true
  }

  private mergeTraceGroup(traces: SolvedTracePath[]) {
    const remaining = [...traces]
    const mergedTraces: SolvedTracePath[] = []

    while (remaining.length > 0) {
      let current = remaining.shift()!
      let didMerge = true

      while (didMerge) {
        didMerge = false
        let bestIndex = -1
        let bestPath: Point[] | null = null

        for (let i = 0; i < remaining.length; i++) {
          const candidatePath = getBestMergedPath(
            current.tracePath,
            remaining[i]!.tracePath,
            this.maxMergeDistance,
          )
          if (!candidatePath) continue
          if (
            !bestPath ||
            candidatePath.length < bestPath.length ||
            getPathLength(candidatePath) < getPathLength(bestPath)
          ) {
            bestIndex = i
            bestPath = candidatePath
          }
        }

        if (bestIndex !== -1 && bestPath) {
          const [candidate] = remaining.splice(bestIndex, 1)
          current = combineTraceMetadata(current, candidate!, bestPath)
          didMerge = true
        }
      }

      mergedTraces.push(current)
    }

    return mergedTraces
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    return {
      lines: this.outputTraces.map((trace) => ({
        points: trace.tracePath,
        strokeColor: getColorFromString(trace.mspPairId, 0.75),
      })),
    }
  }
}

const getPathLength = (points: Point[]) => {
  let length = 0
  for (let i = 0; i < points.length - 1; i++) {
    length += distanceBetween(points[i]!, points[i + 1]!)
  }
  return length
}
