import type { Point } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { simplifyPath } from "./simplifyPath"

const MERGE_THRESHOLD = 0.15

interface Segment {
  traceId: string
  segIndex: number
  orientation: "horizontal" | "vertical"
  coordinate: number
}

/**
 * Merges same-net trace lines that are close together by aligning them
 * to the same Y (for horizontal segments) or same X (for vertical segments).
 *
 * When two traces belong to the same net and have parallel segments with
 * close coordinates, they are adjusted to share the same coordinate value
 * (the average), improving visual clarity.
 */
export const mergeSameNetLines = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
}): SolvedTracePath[] => {
  const tracesByNet = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.dcConnNetId
    if (!tracesByNet.has(netId)) {
      tracesByNet.set(netId, [])
    }
    tracesByNet.get(netId)!.push(trace)
  }

  const TOLERANCE = 1e-5
  const staticObstacles = getObstacleRects(inputProblem).map((obs) => ({
    ...obs,
    minX: obs.minX + TOLERANCE,
    maxX: obs.maxX - TOLERANCE,
    minY: obs.minY + TOLERANCE,
    maxY: obs.maxY - TOLERANCE,
  }))

  const labelBounds = allLabelPlacements.map((nl) => ({
    chipId: `label-${nl.globalConnNetId}`,
    minX: nl.center.x - nl.width / 2 + TOLERANCE,
    maxX: nl.center.x + nl.width / 2 - TOLERANCE,
    minY: nl.center.y - nl.height / 2 + TOLERANCE,
    maxY: nl.center.y + nl.height / 2 - TOLERANCE,
  }))

  const updatedTraces = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))
  const traceMap = new Map(updatedTraces.map((t) => [t.mspPairId, t]))
  const modifiedTraceIds = new Set<string>()

  for (const [_netId, netTraces] of tracesByNet) {
    if (netTraces.length < 2) continue

    const segments: Segment[] = []
    for (const trace of netTraces) {
      const path = traceMap.get(trace.mspPairId)!.tracePath
      for (let i = 0; i < path.length - 1; i++) {
        const p1 = path[i]
        const p2 = path[i + 1]
        const isHoriz = Math.abs(p1.y - p2.y) < TOLERANCE
        const isVert = Math.abs(p1.x - p2.x) < TOLERANCE

        if (isHoriz) {
          segments.push({
            traceId: trace.mspPairId,
            segIndex: i,
            orientation: "horizontal",
            coordinate: p1.y,
          })
        } else if (isVert) {
          segments.push({
            traceId: trace.mspPairId,
            segIndex: i,
            orientation: "vertical",
            coordinate: p1.x,
          })
        }
      }
    }

    for (const orientation of ["horizontal", "vertical"] as const) {
      const orientedSegments = segments.filter(
        (s) => s.orientation === orientation,
      )

      orientedSegments.sort((a, b) => a.coordinate - b.coordinate)

      const merged = new Set<number>()
      for (let i = 0; i < orientedSegments.length; i++) {
        if (merged.has(i)) continue

        const cluster: number[] = [i]
        const traceIdsInCluster = new Set([orientedSegments[i].traceId])

        for (let j = i + 1; j < orientedSegments.length; j++) {
          if (merged.has(j)) continue
          const diff = Math.abs(
            orientedSegments[j].coordinate - orientedSegments[i].coordinate,
          )
          if (diff > MERGE_THRESHOLD) break

          if (traceIdsInCluster.has(orientedSegments[j].traceId)) continue

          cluster.push(j)
          traceIdsInCluster.add(orientedSegments[j].traceId)
        }

        if (cluster.length < 2) continue

        const uniqueTraceIds = new Set(
          cluster.map((idx) => orientedSegments[idx].traceId),
        )
        if (uniqueTraceIds.size < 2) continue

        const avgCoord =
          cluster.reduce(
            (sum, idx) => sum + orientedSegments[idx].coordinate,
            0,
          ) / cluster.length

        let canMerge = true
        for (const idx of cluster) {
          const seg = orientedSegments[idx]
          const trace = traceMap.get(seg.traceId)!
          const path = trace.tracePath

          // Skip endpoint segments (first and last)
          if (seg.segIndex === 0 || seg.segIndex === path.length - 2) {
            canMerge = false
            break
          }

          // Create test path with the merged coordinate
          const testPath = path.map((p) => ({ ...p }))

          if (orientation === "horizontal") {
            testPath[seg.segIndex].y = avgCoord
            testPath[seg.segIndex + 1].y = avgCoord
          } else {
            testPath[seg.segIndex].x = avgCoord
            testPath[seg.segIndex + 1].x = avgCoord
          }

          // Check collisions with obstacles
          for (let k = 0; k < testPath.length - 1; k++) {
            for (const obs of staticObstacles) {
              if (segmentIntersectsRect(testPath[k], testPath[k + 1], obs)) {
                canMerge = false
                break
              }
            }
            if (!canMerge) break
            for (const lb of labelBounds) {
              if (segmentIntersectsRect(testPath[k], testPath[k + 1], lb)) {
                canMerge = false
                break
              }
            }
            if (!canMerge) break
          }
          if (!canMerge) break
        }

        if (!canMerge) continue

        // Apply the merge
        for (const idx of cluster) {
          const seg = orientedSegments[idx]
          const trace = traceMap.get(seg.traceId)!
          const path = trace.tracePath

          if (orientation === "horizontal") {
            path[seg.segIndex].y = avgCoord
            path[seg.segIndex + 1].y = avgCoord
          } else {
            path[seg.segIndex].x = avgCoord
            path[seg.segIndex + 1].x = avgCoord
          }

          modifiedTraceIds.add(seg.traceId)
          merged.add(idx)
        }
      }
    }
  }

  // Only simplify modified traces to avoid unintended changes
  for (const trace of updatedTraces) {
    if (modifiedTraceIds.has(trace.mspPairId)) {
      trace.tracePath = simplifyPath(trace.tracePath)
    }
  }

  return updatedTraces
}
