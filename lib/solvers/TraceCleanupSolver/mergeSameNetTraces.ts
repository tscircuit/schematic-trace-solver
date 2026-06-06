import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Merges same-net trace segments that are close together by aligning them to the same X or Y coordinate.
 */
export const mergeSameNetTraces = (traces: SolvedTracePath[]): SolvedTracePath[] => {
  const TOLERANCE = 0.05
  const updatedTraces = [...traces]

  // Group traces by net
  const netGroups: Record<string, number[]> = {}
  traces.forEach((trace, index) => {
    const netId = trace.globalConnNetId
    if (!netGroups[netId]) netGroups[netId] = []
    netGroups[netId].push(index)
  })

  for (const netId in netGroups) {
    const indices = netGroups[netId]
    if (indices.length < 2) continue

    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const traceA = updatedTraces[indices[i]]
        const traceB = updatedTraces[indices[j]]

        // Compare segments of traceA and traceB
        for (let sA = 0; sA < traceA.tracePath.length - 1; sA++) {
          for (let sB = 0; sB < traceB.tracePath.length - 1; sB++) {
            const segA1 = traceA.tracePath[sA]
            const segA2 = traceA.tracePath[sA + 1]
            const segB1 = traceB.tracePath[sB]
            const segB2 = traceB.tracePath[sB + 1]

            const isAHorizontal = Math.abs(segA1.y - segA2.y) < 1e-6
            const isBHorizontal = Math.abs(segB1.y - segB2.y) < 1e-6

            if (isAHorizontal && isBHorizontal) {
              if (Math.abs(segA1.y - segB1.y) < TOLERANCE) {
                // Align Y coordinates
                const avgY = (segA1.y + segB1.y) / 2
                segA1.y = avgY
                segA2.y = avgY
                segB1.y = avgY
                segB2.y = avgY
              }
            } else if (!isAHorizontal && !isBHorizontal) {
              if (Math.abs(segA1.x - segB1.x) < TOLERANCE) {
                // Align X coordinates
                const avgX = (segA1.x + segB1.x) / 2
                segA1.x = avgX
                segA2.x = avgX
                segB1.x = avgX
                segB2.x = avgX
              }
            }
          }
        }
      }
    }
  }

  return updatedTraces
}
