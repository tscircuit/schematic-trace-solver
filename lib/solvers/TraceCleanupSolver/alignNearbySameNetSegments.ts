import type { Point } from "@tscircuit/math-utils"
import { doSegmentsIntersect } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { simplifyPath } from "./simplifyPath"

type Orientation = "horizontal" | "vertical"

type Segment = {
  traceIndex: number
  segmentIndex: number
  orientation: Orientation
  coord: number
  rangeMin: number
  rangeMax: number
}

type RectLike = {
  chipId: string
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const DEFAULT_MAX_DISTANCE = 0.12
const EPS = 1e-9

const getNetKey = (trace: SolvedTracePath) =>
  trace.globalConnNetId || trace.userNetId || trace.dcConnNetId || null

const getSegmentOrientation = (a: Point, b: Point): Orientation | null => {
  if (Math.abs(a.y - b.y) < EPS) return "horizontal"
  if (Math.abs(a.x - b.x) < EPS) return "vertical"
  return null
}

const getInternalSegments = (
  trace: SolvedTracePath,
  traceIndex: number,
): Segment[] => {
  const segments: Segment[] = []
  const path = trace.tracePath

  for (let i = 1; i < path.length - 2; i++) {
    const a = path[i]!
    const b = path[i + 1]!
    const orientation = getSegmentOrientation(a, b)
    if (!orientation) continue

    segments.push({
      traceIndex,
      segmentIndex: i,
      orientation,
      coord: orientation === "horizontal" ? a.y : a.x,
      rangeMin:
        orientation === "horizontal" ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
      rangeMax:
        orientation === "horizontal" ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
    })
  }

  return segments
}

const rangesOverlap = (a: Segment, b: Segment) =>
  Math.min(a.rangeMax, b.rangeMax) - Math.max(a.rangeMin, b.rangeMin) > EPS

const labelsToRects = (labels: NetLabelPlacement[]): RectLike[] =>
  labels.map((label) => ({
    chipId: label.globalConnNetId,
    minX: label.center.x - label.width / 2,
    maxX: label.center.x + label.width / 2,
    minY: label.center.y - label.height / 2,
    maxY: label.center.y + label.height / 2,
  }))

const moveSegmentToCoord = (
  trace: SolvedTracePath,
  segmentIndex: number,
  orientation: Orientation,
  coord: number,
): SolvedTracePath => {
  const tracePath = trace.tracePath.map((p) => ({ ...p }))

  if (orientation === "horizontal") {
    tracePath[segmentIndex]!.y = coord
    tracePath[segmentIndex + 1]!.y = coord
  } else {
    tracePath[segmentIndex]!.x = coord
    tracePath[segmentIndex + 1]!.x = coord
  }

  return {
    ...trace,
    tracePath: simplifyPath(tracePath),
  }
}

const traceCollidesWithRects = (trace: SolvedTracePath, rects: RectLike[]) => {
  for (let i = 0; i < trace.tracePath.length - 1; i++) {
    const a = trace.tracePath[i]!
    const b = trace.tracePath[i + 1]!

    for (const rect of rects) {
      if (segmentIntersectsRect(a, b, rect)) return true
    }
  }

  return false
}

const traceIntersectsDifferentNet = (
  candidateTrace: SolvedTracePath,
  traceIndex: number,
  allTraces: SolvedTracePath[],
) => {
  const candidateNetKey = getNetKey(candidateTrace)
  if (!candidateNetKey) return false

  for (let i = 0; i < allTraces.length; i++) {
    if (i === traceIndex) continue

    const otherTrace = allTraces[i]!
    if (getNetKey(otherTrace) === candidateNetKey) continue

    for (
      let aIndex = 0;
      aIndex < candidateTrace.tracePath.length - 1;
      aIndex++
    ) {
      const a1 = candidateTrace.tracePath[aIndex]!
      const a2 = candidateTrace.tracePath[aIndex + 1]!

      for (let bIndex = 0; bIndex < otherTrace.tracePath.length - 1; bIndex++) {
        const b1 = otherTrace.tracePath[bIndex]!
        const b2 = otherTrace.tracePath[bIndex + 1]!

        if (doSegmentsIntersect(a1, a2, b1, b2)) return true
      }
    }
  }

  return false
}

export const alignNearbySameNetSegments = ({
  inputProblem,
  traces,
  labels = [],
  maxDistance = DEFAULT_MAX_DISTANCE,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
  labels?: NetLabelPlacement[]
  maxDistance?: number
}) => {
  const outputTraces = traces.map((trace) => ({
    ...trace,
    tracePath: trace.tracePath.map((p) => ({ ...p })),
  }))
  const rects = [...getObstacleRects(inputProblem), ...labelsToRects(labels)]
  let changed = false

  for (let pass = 0; pass < 4; pass++) {
    let changedThisPass = false

    const segmentsByNet = new Map<string, Segment[]>()
    for (let traceIndex = 0; traceIndex < outputTraces.length; traceIndex++) {
      const trace = outputTraces[traceIndex]!
      const netKey = getNetKey(trace)
      if (!netKey) continue

      const segments = getInternalSegments(trace, traceIndex)
      const existing = segmentsByNet.get(netKey) ?? []
      existing.push(...segments)
      segmentsByNet.set(netKey, existing)
    }

    for (const segments of segmentsByNet.values()) {
      for (let i = 0; i < segments.length; i++) {
        const anchor = segments[i]!

        for (let j = i + 1; j < segments.length; j++) {
          const candidate = segments[j]!
          if (anchor.traceIndex === candidate.traceIndex) continue
          if (anchor.orientation !== candidate.orientation) continue
          if (Math.abs(anchor.coord - candidate.coord) > maxDistance) continue
          if (!rangesOverlap(anchor, candidate)) continue

          const candidateTrace = outputTraces[candidate.traceIndex]!
          const movedTrace = moveSegmentToCoord(
            candidateTrace,
            candidate.segmentIndex,
            candidate.orientation,
            anchor.coord,
          )

          const candidateTraces = [...outputTraces]
          candidateTraces[candidate.traceIndex] = movedTrace

          if (traceCollidesWithRects(movedTrace, rects)) continue
          if (
            traceIntersectsDifferentNet(
              movedTrace,
              candidate.traceIndex,
              candidateTraces,
            )
          ) {
            continue
          }

          outputTraces[candidate.traceIndex] = movedTrace
          changed = true
          changedThisPass = true
        }
      }
    }

    if (!changedThisPass) break
  }

  return { traces: outputTraces, changed }
}
