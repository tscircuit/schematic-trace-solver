import type { Point } from "graphics-debug"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Create a canonical key for a line segment between two points.
 * Direction-independent (A→B == B→A).
 */
function segmentKey(a: Point, b: Point): string {
  const ax = Math.round(a.x * 1000) / 1000
  const ay = Math.round(a.y * 1000) / 1000
  const bx = Math.round(b.x * 1000) / 1000
  const by = Math.round(b.y * 1000) / 1000

  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}-${bx},${by}`
  }
  return `${bx},${by}-${ax},${ay}`
}

/**
 * Remove duplicate trace segments within the same net.
 *
 * When multiple MSP pairs in the same net share a pin, they get routed
 * independently and produce overlapping segments near the shared pin.
 * This trims duplicate segments from the start and end of later traces
 * (where shared pins produce overlap), preserving path connectivity.
 */
export function removeNetSegmentDuplicates(
  traces: SolvedTracePath[],
): SolvedTracePath[] {
  // Group traces by net
  const netGroups = new Map<string, SolvedTracePath[]>()
  for (const trace of traces) {
    const netId = trace.globalConnNetId
    if (!netGroups.has(netId)) {
      netGroups.set(netId, [])
    }
    netGroups.get(netId)!.push(trace)
  }

  const result: SolvedTracePath[] = []
  for (const [_netId, group] of netGroups) {
    if (group.length <= 1) {
      result.push(...group)
      continue
    }

    // First trace claims all its segments
    const claimedSegments = new Set<string>()
    const firstTrace = group[0]
    for (let i = 1; i < firstTrace.tracePath.length; i++) {
      claimedSegments.add(
        segmentKey(firstTrace.tracePath[i - 1], firstTrace.tracePath[i]),
      )
    }
    result.push(firstTrace)

    // For subsequent traces, trim duplicate segments from the start and end
    for (let t = 1; t < group.length; t++) {
      const trace = group[t]
      const path = trace.tracePath
      if (path.length < 2) {
        result.push(trace)
        continue
      }

      // Trim duplicate segments from the start of the path
      let startIdx = 0
      while (startIdx < path.length - 1) {
        const key = segmentKey(path[startIdx], path[startIdx + 1])
        if (claimedSegments.has(key)) {
          startIdx++
        } else {
          break
        }
      }

      // Trim duplicate segments from the end of the path
      let endIdx = path.length - 1
      while (endIdx > startIdx) {
        const key = segmentKey(path[endIdx - 1], path[endIdx])
        if (claimedSegments.has(key)) {
          endIdx--
        } else {
          break
        }
      }

      // Claim the remaining segments
      const trimmedPath = path.slice(startIdx, endIdx + 1)
      for (let i = 1; i < trimmedPath.length; i++) {
        claimedSegments.add(segmentKey(trimmedPath[i - 1], trimmedPath[i]))
      }

      result.push({
        ...trace,
        tracePath: trimmedPath.length >= 2 ? trimmedPath : path,
      })
    }
  }

  return result
}
