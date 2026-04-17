import { simplifyTracePath } from "lib/utils/simplifyTracePath"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  isHorizontal,
  isVertical,
} from "../SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"

const EPS = 0.05

export const mergeSameNetTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const newTraces = structuredClone(traces)

  // 1. Group traces by net
  const netGroups: Record<string, SolvedTracePath[]> = {}
  for (const trace of newTraces) {
    const netId = trace.globalConnNetId
    if (!netGroups[netId]) netGroups[netId] = []
    netGroups[netId].push(trace)
  }

  // 2. Process each net
  for (const netId in netGroups) {
    const netTraces = netGroups[netId]!
    if (netTraces.length < 1) continue

    // Collect all horizontal and vertical segments
    const horzSegments: Array<{ trace: SolvedTracePath; pointIndex: number }> = []
    const vertSegments: Array<{ trace: SolvedTracePath; pointIndex: number }> = []

    for (const trace of netTraces) {
      for (let i = 0; i < trace.tracePath.length - 1; i++) {
        const p1 = trace.tracePath[i]
        const p2 = trace.tracePath[i + 1]
        if (isHorizontal(p1, p2)) {
          horzSegments.push({ trace, pointIndex: i })
        } else if (isVertical(p1, p2)) {
          vertSegments.push({ trace, pointIndex: i })
        }
      }
    }

    // Merge horizontal segments (snap Y)
    for (let i = 0; i < horzSegments.length; i++) {
      const seg1 = horzSegments[i]!
      const p1_1 = seg1.trace.tracePath[seg1.pointIndex]!
      const p1_2 = seg1.trace.tracePath[seg1.pointIndex + 1]!
      const y1 = p1_1.y
      const minX1 = Math.min(p1_1.x, p1_2.x)
      const maxX1 = Math.max(p1_1.x, p1_2.x)

      for (let j = i + 1; j < horzSegments.length; j++) {
        const seg2 = horzSegments[j]!
        const p2_1 = seg2.trace.tracePath[seg2.pointIndex]!
        const p2_2 = seg2.trace.tracePath[seg2.pointIndex + 1]!
        const y2 = p2_1.y
        const minX2 = Math.min(p2_1.x, p2_2.x)
        const maxX2 = Math.max(p2_1.x, p2_2.x)

        if (Math.abs(y1 - y2) < EPS && Math.abs(y1 - y2) > 1e-6) {
          // Check if they "overlap" in X or are very close in X
          const overlap = Math.min(maxX1, maxX2) - Math.max(minX1, minX2)
          if (overlap > -EPS) {
            // ONLY snap if NOT a pin point
            const isPin1 = seg2.pointIndex === 0
            const isPin2 = seg2.pointIndex + 1 === seg2.trace.tracePath.length - 1

            if (!isPin1) p2_1.y = y1
            if (!isPin2) p2_2.y = y1
          }
        }
      }
    }

    // Merge vertical segments (snap X)
    for (let i = 0; i < vertSegments.length; i++) {
      const seg1 = vertSegments[i]!
      const p1_1 = seg1.trace.tracePath[seg1.pointIndex]!
      const p1_2 = seg1.trace.tracePath[seg1.pointIndex + 1]!
      const x1 = p1_1.x
      const minY1 = Math.min(p1_1.y, p1_2.y)
      const maxY1 = Math.max(p1_1.y, p1_2.y)

      for (let j = i + 1; j < vertSegments.length; j++) {
        const seg2 = vertSegments[j]!
        const p2_1 = seg2.trace.tracePath[seg2.pointIndex]!
        const p2_2 = seg2.trace.tracePath[seg2.pointIndex + 1]!
        const x2 = p2_1.x
        const minY2 = Math.min(p2_1.y, p2_2.y)
        const maxY2 = Math.max(p2_1.y, p2_2.y)

        if (Math.abs(x1 - x2) < EPS && Math.abs(x1 - x2) > 1e-6) {
          // Check if they "overlap" in Y or are very close in Y
          const overlap = Math.min(maxY1, maxY2) - Math.max(minY1, minY2)
          if (overlap > -EPS) {
            // ONLY snap if NOT a pin point
            const isPin1 = seg2.pointIndex === 0
            const isPin2 = seg2.pointIndex + 1 === seg2.trace.tracePath.length - 1

            if (!isPin1) p2_1.x = x1
            if (!isPin2) p2_2.x = x1
          }
        }
      }
    }
  }

  // 3. Simplify paths
  for (const trace of newTraces) {
    trace.tracePath = simplifyTracePath(trace.tracePath)
  }

  return newTraces
}
