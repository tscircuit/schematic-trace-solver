import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { GraphicsObject } from "graphics-debug"

type Orientation = "horizontal" | "vertical"

interface SegmentRef {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  fixedCoord: number
  min: number
  max: number
  length: number
}

const EPS = 1e-6
const DEFAULT_MERGE_DISTANCE = 0.18

const getTraceNetId = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const closeEnough = (a: number, b: number) => Math.abs(a - b) <= EPS

const rangeGap = (a: SegmentRef, b: SegmentRef) =>
  Math.max(0, Math.max(a.min, b.min) - Math.min(a.max, b.max))

const canMoveSegmentFixedCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
) => {
  const path = trace.tracePath
  const start = path[segmentIndex]!
  const end = path[segmentIndex + 1]!
  const prev = path[segmentIndex - 1]
  const next = path[segmentIndex + 2]

  if (orientation === "horizontal") {
    const prevOk = !prev || closeEnough(prev.x, start.x)
    const nextOk = !next || closeEnough(next.x, end.x)
    return prevOk && nextOk
  }

  const prevOk = !prev || closeEnough(prev.y, start.y)
  const nextOk = !next || closeEnough(next.y, end.y)
  return prevOk && nextOk
}

const getSegments = (traces: SolvedTracePath[]) => {
  const segmentsByNet: Record<string, SegmentRef[]> = {}

  for (let traceIndex = 0; traceIndex < traces.length; traceIndex++) {
    const trace = traces[traceIndex]!
    const netId = getTraceNetId(trace)
    const path = trace.tracePath

    for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex++) {
      const start = path[segmentIndex]!
      const end = path[segmentIndex + 1]!
      const dx = Math.abs(start.x - end.x)
      const dy = Math.abs(start.y - end.y)

      if (dx <= EPS && dy <= EPS) continue

      let segment: SegmentRef | null = null
      if (dy <= EPS && dx > EPS) {
        segment = {
          traceIndex,
          segmentIndex,
          orientation: "horizontal",
          fixedCoord: start.y,
          min: Math.min(start.x, end.x),
          max: Math.max(start.x, end.x),
          length: dx,
        }
      } else if (dx <= EPS && dy > EPS) {
        segment = {
          traceIndex,
          segmentIndex,
          orientation: "vertical",
          fixedCoord: start.x,
          min: Math.min(start.y, end.y),
          max: Math.max(start.y, end.y),
          length: dy,
        }
      }

      if (!segment) continue
      if (!canMoveSegmentFixedCoord(trace, segmentIndex, segment.orientation)) {
        continue
      }

      segmentsByNet[netId] ??= []
      segmentsByNet[netId]!.push(segment)
    }
  }

  return segmentsByNet
}

const makeUnionFind = (size: number) => {
  const parent = Array.from({ length: size }, (_, index) => index)

  const find = (index: number): number => {
    if (parent[index] !== index) parent[index] = find(parent[index]!)
    return parent[index]!
  }

  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  return { find, union }
}

const alignSegment = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
  fixedCoord: number,
) => {
  const start = trace.tracePath[segmentIndex]!
  const end = trace.tracePath[segmentIndex + 1]!

  if (orientation === "horizontal") {
    start.y = fixedCoord
    end.y = fixedCoord
  } else {
    start.x = fixedCoord
    end.x = fixedCoord
  }
}

const simplifyPath = (path: SolvedTracePath["tracePath"]) => {
  const deduped = path.filter(
    (point, index) =>
      index === 0 ||
      !(
        closeEnough(point.x, path[index - 1]!.x) &&
        closeEnough(point.y, path[index - 1]!.y)
      ),
  )

  const simplified: typeof path = []
  for (const point of deduped) {
    const prev = simplified[simplified.length - 1]
    const prevPrev = simplified[simplified.length - 2]

    if (
      prev &&
      prevPrev &&
      ((closeEnough(prevPrev.x, prev.x) && closeEnough(prev.x, point.x)) ||
        (closeEnough(prevPrev.y, prev.y) && closeEnough(prev.y, point.y)))
    ) {
      simplified[simplified.length - 1] = point
    } else {
      simplified.push(point)
    }
  }

  return simplified
}

export const mergeSameNetCloseTraceSegments = (
  traces: SolvedTracePath[],
  mergeDistance = DEFAULT_MERGE_DISTANCE,
) => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((point) => ({ ...point })),
  }))

  const segmentsByNet = getSegments(outputTraces)

  for (const segments of Object.values(segmentsByNet)) {
    const { find, union } = makeUnionFind(segments.length)

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i]!
        const b = segments[j]!

        if (a.orientation !== b.orientation) continue
        if (Math.abs(a.fixedCoord - b.fixedCoord) > mergeDistance) continue
        if (rangeGap(a, b) > mergeDistance) continue

        union(i, j)
      }
    }

    const segmentGroups = new Map<number, SegmentRef[]>()
    for (let i = 0; i < segments.length; i++) {
      const root = find(i)
      segmentGroups.set(root, [
        ...(segmentGroups.get(root) ?? []),
        segments[i]!,
      ])
    }

    for (const group of segmentGroups.values()) {
      if (group.length < 2) continue

      const totalLength = group.reduce(
        (sum, segment) => sum + segment.length,
        0,
      )
      const targetCoord =
        group.reduce(
          (sum, segment) => sum + segment.fixedCoord * segment.length,
          0,
        ) / totalLength

      for (const segment of group) {
        alignSegment(
          outputTraces[segment.traceIndex]!,
          segment.segmentIndex,
          segment.orientation,
          targetCoord,
        )
      }
    }
  }

  return outputTraces.map((trace) => ({
    ...trace,
    tracePath: simplifyPath(trace.tracePath),
  }))
}

export class SameNetTraceSegmentMergeSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: SolvedTracePath[]
  mergeDistance: number
  outputTraces: SolvedTracePath[]

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: SolvedTracePath[]
    mergeDistance?: number
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths
    this.mergeDistance = params.mergeDistance ?? DEFAULT_MERGE_DISTANCE
    this.outputTraces = params.inputTracePaths
  }

  override getConstructorParams(): ConstructorParameters<
    typeof SameNetTraceSegmentMergeSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
      mergeDistance: this.mergeDistance,
    }
  }

  override _step() {
    this.outputTraces = mergeSameNetCloseTraceSegments(
      this.inputTracePaths,
      this.mergeDistance,
    )
    this.solved = true
  }

  getOutput() {
    return {
      traces: this.outputTraces,
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.lines ??= []

    for (const trace of this.outputTraces) {
      graphics.lines.push({
        points: trace.tracePath,
        strokeColor: "purple",
      })
    }

    return graphics
  }
}
