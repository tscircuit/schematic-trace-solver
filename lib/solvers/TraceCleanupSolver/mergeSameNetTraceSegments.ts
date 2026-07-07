import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

type Orientation = "horizontal" | "vertical"

type InteriorSegment = {
  traceIndex: number
  pointIndex: number
  orientation: Orientation
  coord: number
  rangeMin: number
  rangeMax: number
  netKey: string
}

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) >= Math.max(a0, b0)

const clonePoint = (p: Point): Point => ({ ...p })

const resolveNetKey = (
  trace: SolvedTracePath,
  mergedLabelNetIdMap?: Record<string, Set<string>>,
): string | null => {
  const base = trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId
  if (!base) return null

  if (mergedLabelNetIdMap) {
    for (const [mergedKey, memberNets] of Object.entries(mergedLabelNetIdMap)) {
      if (memberNets.has(base) || mergedKey === base) return mergedKey
    }
  }

  return base
}

const collectInteriorSegments = (
  traces: SolvedTracePath[],
  mergedLabelNetIdMap?: Record<string, Set<string>>,
): InteriorSegment[] => {
  const segments: InteriorSegment[] = []

  traces.forEach((trace, traceIndex) => {
    const netKey = resolveNetKey(trace, mergedLabelNetIdMap)
    if (!netKey) return

    const path = trace.tracePath
    for (let i = 1; i < path.length - 2; i++) {
      const p1 = path[i]!
      const p2 = path[i + 1]!

      if (isHorizontal(p1, p2)) {
        segments.push({
          traceIndex,
          pointIndex: i,
          orientation: "horizontal",
          coord: p1.y,
          rangeMin: Math.min(p1.x, p2.x),
          rangeMax: Math.max(p1.x, p2.x),
          netKey,
        })
      } else if (isVertical(p1, p2)) {
        segments.push({
          traceIndex,
          pointIndex: i,
          orientation: "vertical",
          coord: p1.x,
          rangeMin: Math.min(p1.y, p2.y),
          rangeMax: Math.max(p1.y, p2.y),
          netKey,
        })
      }
    }
  })

  return segments
}

const setSegmentCoord = (
  path: Point[],
  segment: InteriorSegment,
  coord: number,
) => {
  const p1 = path[segment.pointIndex]!
  const p2 = path[segment.pointIndex + 1]!

  if (segment.orientation === "horizontal") {
    path[segment.pointIndex] = clonePoint({ ...p1, y: coord })
    path[segment.pointIndex + 1] = clonePoint({ ...p2, y: coord })
  } else {
    path[segment.pointIndex] = clonePoint({ ...p1, x: coord })
    path[segment.pointIndex + 1] = clonePoint({ ...p2, x: coord })
  }
}

/**
 * Aligns close, overlapping orthogonal interior segments that belong to the same net
 * so they share the same X (vertical) or Y (horizontal) coordinate.
 */
export const mergeSameNetTraceSegments = (
  traces: SolvedTracePath[],
  {
    tolerance = 0.12,
    mergedLabelNetIdMap,
  }: {
    tolerance?: number
    mergedLabelNetIdMap?: Record<string, Set<string>>
  } = {},
): SolvedTracePath[] => {
  const output = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map(clonePoint),
  }))
  const segments = collectInteriorSegments(traces, mergedLabelNetIdMap)

  for (let i = 0; i < segments.length; i++) {
    const a = segments[i]!

    for (let j = i + 1; j < segments.length; j++) {
      const b = segments[j]!
      if (a.netKey !== b.netKey) continue
      if (a.orientation !== b.orientation) continue
      if (Math.abs(a.coord - b.coord) > tolerance) continue
      if (!rangesOverlap(a.rangeMin, a.rangeMax, b.rangeMin, b.rangeMax))
        continue

      const targetCoord = a.coord
      setSegmentCoord(output[b.traceIndex]!.tracePath, b, targetCoord)
      b.coord = targetCoord
    }
  }

  return output
}
