import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Aligns parallel trace segments belonging to the same net if they are within a certain threshold.
 * This helps in visually merging traces that should appear as a single continuous line.
 * Resolves #34 and #86.
 */
export const alignSameNetTraces = (traces: SolvedTracePath[]): SolvedTracePath[] => {
  const EPS = 0.3 // Threshold for snapping (approx 0.3 units)
  const COORD_EPS = 1e-6

  // Group traces by globalConnNetId
  const netGroups: Record<string, SolvedTracePath[]> = {}
  for (const trace of traces) {
    const netId = trace.globalConnNetId || "unknown"
    if (!netGroups[netId]) netGroups[netId] = []
    netGroups[netId].push(trace)
  }

  for (const netId in netGroups) {
    if (netId === "unknown") continue
    const group = netGroups[netId]!
    if (group.length < 2) continue

    // For each pair of traces in the same net
    for (let i = 0; i < group.length; i++) {
      for (let j = 0; j < group.length; j++) {
        if (i === j) continue
        const traceA = group[i]!
        const traceB = group[j]!

        // Find segments in traceA and traceB that are parallel and close
        for (let sa = 0; sa < traceA.tracePath.length - 1; sa++) {
          const a1 = traceA.tracePath[sa]!
          const a2 = traceA.tracePath[sa + 1]!
          const aVert = Math.abs(a1.x - a2.x) < COORD_EPS
          const aHorz = Math.abs(a1.y - a2.y) < COORD_EPS

          for (let sb = 0; sb < traceB.tracePath.length - 1; sb++) {
            const b1 = traceB.tracePath[sb]!
            const b2 = traceB.tracePath[sb + 1]!
            const bVert = Math.abs(b1.x - b2.x) < COORD_EPS
            const bHorz = Math.abs(b1.y - b2.y) < COORD_EPS

            if (aVert && bVert) {
              // Both vertical, check distance in X
              const dist = Math.abs(a1.x - b1.x)
              if (dist > 0 && dist < EPS) {
                // Check if they overlap in Y or are near
                const overlapY = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
                if (overlapY > -EPS) {
                  // Snap traceB segment to traceA's X
                  b1.x = a1.x
                  b2.x = a1.x
                }
              }
            } else if (aHorz && bHorz) {
              // Both horizontal, check distance in Y
              const dist = Math.abs(a1.y - b1.y)
              if (dist > 0 && dist < EPS) {
                // Check if they overlap in X or are near
                const overlapX = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
                if (overlapX > -EPS) {
                  // Snap traceB segment to traceA's Y
                  b1.y = a1.y
                  b2.y = a1.y
                }
              }
            }
          }
        }
      }
    }
  }

  return traces
}
