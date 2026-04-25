import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Aligns parallel trace segments belonging to the same net if they are within a certain threshold.
 * This helps in visually merging traces that should appear as a single continuous line.
 * Implements weighted averaging and overlap detection for superior stability.
 */
export const alignSameNetTraces = (
  traces: SolvedTracePath[],
  options: { snapThreshold?: number } = {}
): SolvedTracePath[] => {
  const EPS = options.snapThreshold ?? 0.3
  const COORD_EPS = 1e-6

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

    // Collect all segments in the net
    const segments: Array<{
      traceIdx: number
      segIdx: number
      p1: { x: number; y: number }
      p2: { x: number; y: number }
      isVert: boolean
      len: number
    }> = []

    for (let t = 0; t < group.length; t++) {
      const trace = group[t]!
      for (let s = 0; s < trace.tracePath.length - 1; s++) {
        const p1 = trace.tracePath[s]!
        const p2 = trace.tracePath[s + 1]!
        const isVert = Math.abs(p1.x - p2.x) < COORD_EPS
        const isHorz = Math.abs(p1.y - p2.y) < COORD_EPS
        if (isVert || isHorz) {
          segments.push({
            traceIdx: t,
            segIdx: s,
            p1,
            p2,
            isVert,
            len: isVert ? Math.abs(p1.y - p2.y) : Math.abs(p1.x - p2.x)
          })
        }
      }
    }

    // Cluster segments that are close and parallel
    const clusters: Array<{
      isVert: boolean
      segments: typeof segments
      avgPos: number
    }> = []

    for (const seg of segments) {
      let added = false
      for (const cluster of clusters) {
        if (cluster.isVert === seg.isVert) {
          const pos = seg.isVert ? seg.p1.x : seg.p1.y
          if (Math.abs(cluster.avgPos - pos) < EPS) {
            // Check for 1D overlap or near-proximity along the shared axis
            const sMin = seg.isVert ? Math.min(seg.p1.y, seg.p2.y) : Math.min(seg.p1.x, seg.p2.x)
            const sMax = seg.isVert ? Math.max(seg.p1.y, seg.p2.y) : Math.max(seg.p1.x, seg.p2.x)
            
            const overlaps = cluster.segments.some(cs => {
              const csMin = cs.isVert ? Math.min(cs.p1.y, cs.p2.y) : Math.min(cs.p1.x, cs.p2.x)
              const csMax = cs.isVert ? Math.max(cs.p1.y, cs.p2.y) : Math.max(cs.p1.x, cs.p2.x)
              return Math.min(sMax, csMax) - Math.max(sMin, csMin) > -EPS
            })

            if (overlaps) {
              cluster.segments.push(seg)
              // Recompute weighted average
              const totalLen = cluster.segments.reduce((acc, s) => acc + s.len, 0)
              cluster.avgPos = cluster.segments.reduce((acc, s) => acc + (s.isVert ? s.p1.x : s.p1.y) * s.len, 0) / totalLen
              added = true
              break
            }
          }
        }
      }
      if (!added) {
        clusters.push({
          isVert: seg.isVert,
          segments: [seg],
          avgPos: seg.isVert ? seg.p1.x : seg.p1.y
        })
      }
    }

    // Apply averaged positions
    for (const cluster of clusters) {
      if (cluster.segments.length > 1) {
        for (const seg of cluster.segments) {
          if (seg.isVert) {
            seg.p1.x = cluster.avgPos
            seg.p2.x = cluster.avgPos
          } else {
            seg.p1.y = cluster.avgPos
            seg.p2.y = cluster.avgPos
          }
        }
      }
    }
  }

  return traces
}
