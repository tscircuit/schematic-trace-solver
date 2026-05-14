import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 2e-3

/**
 * Default maximum perpendicular distance for two parallel same-net segments
 * to be considered "close together" and therefore mergeable.
 */
const DEFAULT_CLOSE_THRESHOLD = 0.15

interface InternalSegment {
  traceIndex: number
  pointIndex: number
  isHorizontal: boolean
  /** Y for horizontal segments, X for vertical segments */
  coord: number
  /** Lower bound on the parallel axis */
  parallelStart: number
  /** Upper bound on the parallel axis */
  parallelEnd: number
}

/**
 * Aligns parallel segments from same-net traces that are close together but
 * not perfectly co-linear so they share a common Y (horizontal) or X
 * (vertical) coordinate. Only segments that are strictly internal (neither
 * endpoint is a pin endpoint of the trace path) are considered so that
 * adjustments cannot detach a trace from its pin.
 */
export function mergeSameNetCloseTraces(
  traces: SolvedTracePath[],
  closeThreshold: number = DEFAULT_CLOSE_THRESHOLD,
): SolvedTracePath[] {
  const newTraces = traces.map((t) => ({
    ...t,
    tracePath: t.tracePath.map((p) => ({ ...p })),
  }))

  const groupsByNet: Record<string, number[]> = {}
  newTraces.forEach((t, i) => {
    if (!groupsByNet[t.globalConnNetId]) groupsByNet[t.globalConnNetId] = []
    groupsByNet[t.globalConnNetId]!.push(i)
  })

  for (const traceIndices of Object.values(groupsByNet)) {
    if (traceIndices.length < 2) continue

    const collectInternalSegments = (): InternalSegment[] => {
      const segments: InternalSegment[] = []
      for (const ti of traceIndices) {
        const path = newTraces[ti]!.tracePath
        // Segments touching path endpoints connect to pins; skip them so we
        // never alter pin connections.
        for (let pi = 1; pi < path.length - 2; pi++) {
          const p1 = path[pi]!
          const p2 = path[pi + 1]!
          const isHorz =
            Math.abs(p1.y - p2.y) < EPS && Math.abs(p1.x - p2.x) >= EPS
          const isVert =
            Math.abs(p1.x - p2.x) < EPS && Math.abs(p1.y - p2.y) >= EPS
          if (!isHorz && !isVert) continue
          segments.push({
            traceIndex: ti,
            pointIndex: pi,
            isHorizontal: isHorz,
            coord: isHorz ? (p1.y + p2.y) / 2 : (p1.x + p2.x) / 2,
            parallelStart: isHorz
              ? Math.min(p1.x, p2.x)
              : Math.min(p1.y, p2.y),
            parallelEnd: isHorz ? Math.max(p1.x, p2.x) : Math.max(p1.y, p2.y),
          })
        }
      }
      return segments
    }

    let changed = true
    let safetyIterations = 0
    while (changed && safetyIterations < 32) {
      changed = false
      safetyIterations++
      const segments = collectInternalSegments()

      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i]!
          const b = segments[j]!
          if (a.traceIndex === b.traceIndex) continue
          if (a.isHorizontal !== b.isHorizontal) continue

          const parallelOverlap =
            Math.min(a.parallelEnd, b.parallelEnd) -
            Math.max(a.parallelStart, b.parallelStart)
          if (parallelOverlap <= EPS) continue

          const perpDist = Math.abs(a.coord - b.coord)
          if (perpDist < EPS) continue
          if (perpDist > closeThreshold) continue

          const newCoord = (a.coord + b.coord) / 2

          const apply = (s: InternalSegment) => {
            const path = newTraces[s.traceIndex]!.tracePath
            const key: "x" | "y" = s.isHorizontal ? "y" : "x"
            path[s.pointIndex]![key] = newCoord
            path[s.pointIndex + 1]![key] = newCoord
            s.coord = newCoord
          }

          apply(a)
          apply(b)
          changed = true
        }
      }
    }
  }

  return newTraces
}
