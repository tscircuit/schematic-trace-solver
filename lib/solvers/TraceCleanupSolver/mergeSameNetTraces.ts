import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { hasCollisions } from "./hasCollisions"
import { simplifyPath } from "./simplifyPath"

const isPathValid = (
  path: Point[],
  targetTrace: SolvedTracePath,
  staticObstacles: any[],
  allLabelPlacements: NetLabelPlacement[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
  paddingBuffer: number,
): boolean => {
  if (hasCollisions(path, staticObstacles)) {
    return false
  }

  const filteredLabels = allLabelPlacements.filter((label) => {
    const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
    if (originalNetIds) {
      return !originalNetIds.has(targetTrace.globalConnNetId)
    }
    return label.globalConnNetId !== targetTrace.globalConnNetId
  })

  const labelBounds = filteredLabels.map((nl) => ({
    minX: nl.center.x - nl.width / 2 - paddingBuffer,
    maxX: nl.center.x + nl.width / 2 + paddingBuffer,
    minY: nl.center.y - nl.height / 2 - paddingBuffer,
    maxY: nl.center.y + nl.height / 2 + paddingBuffer,
  }))

  if (hasCollisions(path, labelBounds)) {
    return false
  }

  return true
}

export const mergeSameNetTraces = (
  traces: SolvedTracePath[],
  inputProblem: InputProblem,
  allLabelPlacements: NetLabelPlacement[],
  mergedLabelNetIdMap: Record<string, Set<string>>,
  paddingBuffer: number,
): SolvedTracePath[] => {
  const staticObstaclesRaw = getObstacleRects(inputProblem)
  const PADDING = 0.01
  const staticObstacles = staticObstaclesRaw.map((obs) => ({
    ...obs,
    minX: obs.minX - PADDING,
    minY: obs.minY - PADDING,
    maxX: obs.maxX + PADDING,
    maxY: obs.maxY + PADDING,
  }))

  // 1. Keep a copy of original paths
  const originalPaths = new Map<string, Point[]>()
  for (const trace of traces) {
    originalPaths.set(
      trace.mspPairId,
      trace.tracePath.map((p) => ({ x: p.x, y: p.y })),
    )
  }

  // 2. Group traces by globalConnNetId
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  // 3. For each net, perform snapping
  for (const [netId, netTraces] of tracesByNet.entries()) {
    if (netTraces.length < 2) continue

    // A. Collect all horizontal segments
    interface HorizSegment {
      p1: Point
      p2: Point
      y: number
      length: number
      isFixed: boolean
    }
    const horizSegments: HorizSegment[] = []

    // B. Collect all vertical segments
    interface VertSegment {
      p1: Point
      p2: Point
      x: number
      length: number
      isFixed: boolean
    }
    const vertSegments: VertSegment[] = []

    for (const trace of netTraces) {
      const path = trace.tracePath
      const N = path.length
      for (let j = 0; j < N - 1; j++) {
        const p1 = path[j]
        const p2 = path[j + 1]
        const isFixed = j === 0 || j === N - 2

        if (Math.abs(p1.y - p2.y) < 1e-6) {
          horizSegments.push({
            p1,
            p2,
            y: p1.y,
            length: Math.abs(p1.x - p2.x),
            isFixed,
          })
        } else if (Math.abs(p1.x - p2.x) < 1e-6) {
          vertSegments.push({
            p1,
            p2,
            x: p1.x,
            length: Math.abs(p1.y - p2.y),
            isFixed,
          })
        }
      }
    }

    // Snapping Horizontal Segments (Y coordinate)
    if (horizSegments.length > 1) {
      const parent = new Map<HorizSegment, HorizSegment>()
      const find = (s: HorizSegment): HorizSegment => {
        if (!parent.has(s)) return s
        const root = find(parent.get(s)!)
        parent.set(s, root)
        return root
      }
      const union = (s1: HorizSegment, s2: HorizSegment) => {
        const r1 = find(s1)
        const r2 = find(s2)
        if (r1 !== r2) parent.set(r1, r2)
      }

      for (let i = 0; i < horizSegments.length; i++) {
        for (let j = i + 1; j < horizSegments.length; j++) {
          const s1 = horizSegments[i]
          const s2 = horizSegments[j]
          if (Math.abs(s1.y - s2.y) <= 3.0) {
            union(s1, s2)
          }
        }
      }

      const clusters = new Map<HorizSegment, HorizSegment[]>()
      for (const s of horizSegments) {
        const root = find(s)
        if (!clusters.has(root)) {
          clusters.set(root, [])
        }
        clusters.get(root)!.push(s)
      }

      for (const cluster of clusters.values()) {
        if (cluster.length < 2) continue

        // Determine target Y
        const fixedSegs = cluster.filter((s) => s.isFixed)
        let targetY: number
        if (fixedSegs.length > 0) {
          fixedSegs.sort((a, b) => b.length - a.length)
          targetY = fixedSegs[0].y
        } else {
          cluster.sort((a, b) => b.length - a.length)
          targetY = cluster[0].y
        }

        // Apply Y to all movable segments in the cluster
        for (const s of cluster) {
          if (!s.isFixed) {
            s.p1.y = targetY
            s.p2.y = targetY
          }
        }
      }
    }

    // Snapping Vertical Segments (X coordinate)
    if (vertSegments.length > 1) {
      const parent = new Map<VertSegment, VertSegment>()
      const find = (s: VertSegment): VertSegment => {
        if (!parent.has(s)) return s
        const root = find(parent.get(s)!)
        parent.set(s, root)
        return root
      }
      const union = (s1: VertSegment, s2: VertSegment) => {
        const r1 = find(s1)
        const r2 = find(s2)
        if (r1 !== r2) parent.set(r1, r2)
      }

      for (let i = 0; i < vertSegments.length; i++) {
        for (let j = i + 1; j < vertSegments.length; j++) {
          const s1 = vertSegments[i]
          const s2 = vertSegments[j]
          if (Math.abs(s1.x - s2.x) <= 3.0) {
            union(s1, s2)
          }
        }
      }

      const clusters = new Map<VertSegment, VertSegment[]>()
      for (const s of vertSegments) {
        const root = find(s)
        if (!clusters.has(root)) {
          clusters.set(root, [])
        }
        clusters.get(root)!.push(s)
      }

      for (const cluster of clusters.values()) {
        if (cluster.length < 2) continue

        // Determine target X
        const fixedSegs = cluster.filter((s) => s.isFixed)
        let targetX: number
        if (fixedSegs.length > 0) {
          fixedSegs.sort((a, b) => b.length - a.length)
          targetX = fixedSegs[0].x
        } else {
          cluster.sort((a, b) => b.length - a.length)
          targetX = cluster[0].x
        }

        // Apply X to all movable segments in the cluster
        for (const s of cluster) {
          if (!s.isFixed) {
            s.p1.x = targetX
            s.p2.x = targetX
          }
        }
      }
    }
  }

  // 4. Validate and clean paths
  for (const trace of traces) {
    const origPath = originalPaths.get(trace.mspPairId)!
    const currentPath = trace.tracePath

    // deduplicate adjacent points
    const noDuplicates: Point[] = []
    for (const p of currentPath) {
      if (noDuplicates.length === 0) {
        noDuplicates.push(p)
      } else {
        const last = noDuplicates[noDuplicates.length - 1]
        if (Math.abs(last.x - p.x) < 1e-6 && Math.abs(last.y - p.y) < 1e-6) {
          continue
        }
        noDuplicates.push(p)
      }
    }

    const cleanedPath = simplifyPath(noDuplicates)

    if (
      isPathValid(
        cleanedPath,
        trace,
        staticObstacles,
        allLabelPlacements,
        mergedLabelNetIdMap,
        paddingBuffer,
      )
    ) {
      trace.tracePath = cleanedPath
    } else {
      // Revert to original path
      trace.tracePath = origPath
    }
  }

  return traces
}
