import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { hasCollisions } from "./hasCollisions"
import { hasCollisionsWithLabels } from "./hasCollisionsWithLabels"
import { simplifyPath } from "./simplifyPath"

/**
 * Fixes issue #34: same-net trace segments that run at slightly different Y
 * (or X) coordinates with a tiny jog between them, when they should be a
 * single straight line.
 *
 * For every net, groups parallel segments (across all of the net's traces)
 * whose perpendicular offset is small (≤ paddingBuffer) and whose parallel
 * ranges overlap or touch, then snaps them onto a shared coordinate.
 *
 * Safety rules:
 * - A segment containing a path terminal (a pin connection) is an anchor:
 *   it is never moved, and it dictates the shared coordinate. This also
 *   naturally preserves legitimate Z-steps between pins at genuinely
 *   different coordinates (both runs anchored at different coords → skip).
 * - A move is only committed if the affected portion of the path stays
 *   collision-free against chips, other-net traces, and net labels
 *   (labels of the segment's own net are ignored, mirroring
 *   minimizeTurnsWithFilteredLabels).
 */

const COORD_EPS = 1e-6

interface SegmentRef {
  traceId: string
  /** index of the segment's first point in the trace path */
  pointIndex: number
  orientation: "h" | "v"
  /** the perpendicular coordinate (y for horizontal, x for vertical) */
  coord: number
  lo: number
  hi: number
  /** segment contains path[0] or path[len-1] — a pin terminal */
  anchored: boolean
  length: number
}

const collectSegments = (trace: SolvedTracePath): SegmentRef[] => {
  const segments: SegmentRef[] = []
  const path = trace.tracePath
  for (let i = 0; i + 1 < path.length; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    const anchored = i === 0 || i + 1 === path.length - 1
    if (
      Math.abs(p1.y - p2.y) < COORD_EPS &&
      Math.abs(p1.x - p2.x) > COORD_EPS
    ) {
      segments.push({
        traceId: trace.mspPairId,
        pointIndex: i,
        orientation: "h",
        coord: p1.y,
        lo: Math.min(p1.x, p2.x),
        hi: Math.max(p1.x, p2.x),
        anchored,
        length: Math.abs(p1.x - p2.x),
      })
    } else if (
      Math.abs(p1.x - p2.x) < COORD_EPS &&
      Math.abs(p1.y - p2.y) > COORD_EPS
    ) {
      segments.push({
        traceId: trace.mspPairId,
        pointIndex: i,
        orientation: "v",
        coord: p1.x,
        lo: Math.min(p1.y, p2.y),
        hi: Math.max(p1.y, p2.y),
        anchored,
        length: Math.abs(p1.y - p2.y),
      })
    }
  }
  return segments
}

/** Union-find over segments that are near-collinear with overlapping ranges */
const clusterSegments = (
  segments: SegmentRef[],
  mergeThreshold: number,
): SegmentRef[][] => {
  const parent = segments.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!
      i = parent[i]!
    }
    return i
  }
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b)
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const A = segments[i]!
      const B = segments[j]!
      const offset = Math.abs(A.coord - B.coord)
      if (offset < COORD_EPS || offset > mergeThreshold) continue
      const rangeOverlap = Math.min(A.hi, B.hi) - Math.max(A.lo, B.lo)
      if (rangeOverlap < -COORD_EPS) continue
      union(i, j)
    }
  }

  const clusters = new Map<number, SegmentRef[]>()
  for (let i = 0; i < segments.length; i++) {
    const root = find(i)
    if (!clusters.has(root)) clusters.set(root, [])
    clusters.get(root)!.push(segments[i]!)
  }
  return Array.from(clusters.values()).filter((c) => {
    if (c.length < 2) return false
    // only act when the cluster actually spans more than one coordinate
    const coords = c.map((s) => s.coord)
    return Math.max(...coords) - Math.min(...coords) > COORD_EPS
  })
}

const pickTargetCoord = (cluster: SegmentRef[]): number | null => {
  const anchoredCoords = Array.from(
    new Set(cluster.filter((s) => s.anchored).map((s) => s.coord)),
  )
  if (anchoredCoords.length > 1) {
    // anchored segments disagree — this is a legitimate step between pins
    // at different coordinates, not a merge artifact
    const spread = Math.max(...anchoredCoords) - Math.min(...anchoredCoords)
    if (spread > COORD_EPS) return null
  }
  if (anchoredCoords.length === 1) return anchoredCoords[0]!
  // no anchors: snap to the dominant (longest) run for stable aesthetics
  let best = cluster[0]!
  for (const s of cluster) {
    if (s.length > best.length) best = s
  }
  return best.coord
}

export const mergeSameNetNearCollinearSegments = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath[] => {
  const mergeThreshold = paddingBuffer
  const tracesById = new Map(traces.map((t) => [t.mspPairId, t]))

  const PADDING = 0.01
  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX - PADDING,
    minY: obs.minY - PADDING,
    maxX: obs.maxX + PADDING,
    maxY: obs.maxY + PADDING,
  }))

  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const net = trace.globalConnNetId
    if (!tracesByNet.has(net)) tracesByNet.set(net, [])
    tracesByNet.get(net)!.push(trace)
  }

  for (const [netId, netTraces] of tracesByNet) {
    // obstacles for this net: chips + every other net's trace segments
    const TRACE_WIDTH = 0.01
    const otherNetTraceObstacles = traces
      .filter((t) => t.globalConnNetId !== netId)
      .flatMap((trace, ti) =>
        trace.tracePath.slice(0, -1).map((p1, pi) => {
          const p2 = trace.tracePath[pi + 1]!
          return {
            minX: Math.min(p1.x, p2.x) - TRACE_WIDTH / 2,
            minY: Math.min(p1.y, p2.y) - TRACE_WIDTH / 2,
            maxX: Math.max(p1.x, p2.x) + TRACE_WIDTH / 2,
            maxY: Math.max(p1.y, p2.y) + TRACE_WIDTH / 2,
          }
        }),
      )
    const obstacles = [...staticObstacles, ...otherNetTraceObstacles]

    const filteredLabels = allLabelPlacements.filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(netId)
      }
      return label.globalConnNetId !== netId
    })
    const labelBounds = filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 - paddingBuffer,
      maxX: nl.center.x + nl.width / 2 + paddingBuffer,
      minY: nl.center.y - nl.height / 2 - paddingBuffer,
      maxY: nl.center.y + nl.height / 2 + paddingBuffer,
    }))

    for (const orientation of ["h", "v"] as const) {
      const segments = netTraces
        .flatMap((t) => collectSegments(tracesById.get(t.mspPairId)!))
        .filter((s) => s.orientation === orientation)

      for (const cluster of clusterSegments(segments, mergeThreshold)) {
        const target = pickTargetCoord(cluster)
        if (target === null) continue

        for (const seg of cluster) {
          if (seg.anchored) continue
          if (Math.abs(seg.coord - target) < COORD_EPS) continue

          const trace = tracesById.get(seg.traceId)!
          const path = trace.tracePath

          // Re-locate the segment in the (possibly already updated) path:
          // the recorded pointIndex is only valid against the original path,
          // so find the segment by its current coordinate + range instead.
          const idx = findSegmentIndex(path, seg, orientation)
          if (idx === null) continue

          const newPath = path.map((p) => ({ ...p }))
          if (orientation === "h") {
            newPath[idx]!.y = target
            newPath[idx + 1]!.y = target
          } else {
            newPath[idx]!.x = target
            newPath[idx + 1]!.x = target
          }

          // Only reject moves that introduce NEW collisions. Terminal
          // segments always touch their own chip's body, so an absolute
          // collision check would veto every move — compare the set of
          // obstacles hit before vs after instead.
          const affectedStart = Math.max(0, idx - 1)
          const affectedEnd = Math.min(newPath.length - 1, idx + 2)
          const before = path.slice(affectedStart, affectedEnd + 1)
          const after = newPath.slice(affectedStart, affectedEnd + 1)

          const introducesNewCollision = (rects: any[], useLabels: boolean) => {
            const check = useLabels ? hasCollisionsWithLabels : hasCollisions
            for (const rect of rects) {
              if (check(after, [rect]) && !check(before, [rect])) return true
            }
            return false
          }

          if (introducesNewCollision(obstacles, false)) continue
          if (introducesNewCollision(labelBounds, true)) continue

          tracesById.set(seg.traceId, {
            ...trace,
            tracePath: simplifyPath(newPath),
          })
        }
      }
    }
  }

  return traces.map((t) => tracesById.get(t.mspPairId)!)
}

/**
 * Finds the current index of a recorded segment in a path that may have been
 * modified by earlier merges. Matches on orientation, perpendicular
 * coordinate, and parallel range.
 */
const findSegmentIndex = (
  path: Array<{ x: number; y: number }>,
  seg: SegmentRef,
  orientation: "h" | "v",
): number | null => {
  for (let i = 0; i + 1 < path.length; i++) {
    const p1 = path[i]!
    const p2 = path[i + 1]!
    if (orientation === "h") {
      if (
        Math.abs(p1.y - p2.y) < COORD_EPS &&
        Math.abs(p1.y - seg.coord) < COORD_EPS &&
        Math.abs(Math.min(p1.x, p2.x) - seg.lo) < COORD_EPS &&
        Math.abs(Math.max(p1.x, p2.x) - seg.hi) < COORD_EPS
      ) {
        return i
      }
    } else {
      if (
        Math.abs(p1.x - p2.x) < COORD_EPS &&
        Math.abs(p1.x - seg.coord) < COORD_EPS &&
        Math.abs(Math.min(p1.y, p2.y) - seg.lo) < COORD_EPS &&
        Math.abs(Math.max(p1.y, p2.y) - seg.hi) < COORD_EPS
      ) {
        return i
      }
    }
  }
  return null
}
