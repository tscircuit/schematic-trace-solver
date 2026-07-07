import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

type Point = { x: number; y: number }

/**
 * Merges same-net trace segments that are close together by aligning them to the same X or Y coordinate.
 * All alignment decisions are based on original coordinates (snapshot) to avoid cascading mutations.
 */
export const mergeSameNetTraces = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const TOLERANCE = 0.01

  // Group traces by net, skipping any without a valid net id
  const netGroups: Record<string, number[]> = {}
  traces.forEach((trace, index) => {
    const netId = trace.globalConnNetId
    if (!netId) return
    if (!netGroups[netId]) netGroups[netId] = []
    netGroups[netId].push(index)
  })

  // Collect all alignment updates keyed by (traceIndex, pointIndex) -> {x?, y?}
  // Using original coordinate snapshots so no cascade from earlier updates
  const updates = new Map<string, Partial<Point>>()
  const key = (ti: number, pi: number) => `${ti},${pi}`
  const apply = (ti: number, pi: number, patch: Partial<Point>) => {
    const k = key(ti, pi)
    updates.set(k, { ...(updates.get(k) ?? {}), ...patch })
  }

  // Snapshot original coordinates for comparison (avoids cascade)
  const snapshots: Point[][] = traces.map((t) =>
    t.tracePath.map((p) => ({ x: p.x, y: p.y })),
  )

  for (const netId in netGroups) {
    const indices = netGroups[netId]
    if (indices.length < 2) continue

    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const ti = indices[i]
        const tj = indices[j]
        const snapA = snapshots[ti]
        const snapB = snapshots[tj]

        for (let sA = 0; sA < snapA.length - 1; sA++) {
          for (let sB = 0; sB < snapB.length - 1; sB++) {
            const a1 = snapA[sA]
            const a2 = snapA[sA + 1]
            const b1 = snapB[sB]
            const b2 = snapB[sB + 1]

            const isAHorizontal = Math.abs(a1.y - a2.y) < 1e-6
            const isBHorizontal = Math.abs(b1.y - b2.y) < 1e-6

            if (isAHorizontal && isBHorizontal) {
              if (Math.abs(a1.y - b1.y) < TOLERANCE) {
                const avgY = (a1.y + b1.y) / 2
                apply(ti, sA, { y: avgY })
                apply(ti, sA + 1, { y: avgY })
                apply(tj, sB, { y: avgY })
                apply(tj, sB + 1, { y: avgY })
              }
            } else if (!isAHorizontal && !isBHorizontal) {
              if (Math.abs(a1.x - b1.x) < TOLERANCE) {
                const avgX = (a1.x + b1.x) / 2
                apply(ti, sA, { x: avgX })
                apply(ti, sA + 1, { x: avgX })
                apply(tj, sB, { x: avgX })
                apply(tj, sB + 1, { x: avgX })
              }
            }
          }
        }
      }
    }
  }

  // Apply all collected updates
  const updatedTraces = traces.map((trace, ti) => ({
    ...trace,
    tracePath: trace.tracePath.map((p, pi) => {
      const patch = updates.get(key(ti, pi))
      return patch ? { ...p, ...patch } : p
    }),
  }))

  return updatedTraces
}
