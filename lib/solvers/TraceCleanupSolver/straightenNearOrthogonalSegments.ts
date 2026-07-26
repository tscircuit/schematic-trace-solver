import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

/**
 * Largest deviation, in schematic units, that is treated as a segment meant to
 * be orthogonal. Pin coordinates in real inputs are occasionally off by a
 * fraction of a mil (observed: `5.3999378` against a neighbouring `5.4`), which
 * leaves a segment a few hundredths of a percent off axis. That renders as a
 * visibly skewed trace even though every other segment is orthogonal.
 *
 * Kept well below any intentional offset — the smallest deliberate jog in the
 * solvers is `LABEL_SEARCH_STEP` at 0.1 — so a real diagonal is never
 * flattened.
 */
const MAX_SNAP_DEVIATION = 1e-3

/**
 * Snaps segments that are within `MAX_SNAP_DEVIATION` of horizontal or vertical
 * onto the axis exactly.
 *
 * Schematic traces are orthogonal by construction, so a segment that is almost
 * but not quite axis-aligned is numeric noise inherited from the input rather
 * than a routing decision.
 */
export const straightenNearOrthogonalSegments = (
  traces: SolvedTracePath[],
): { traces: SolvedTracePath[]; straightenedSegmentCount: number } => {
  let straightenedSegmentCount = 0

  const outputTraces = traces.map((trace) => {
    const path = trace.tracePath.map((point) => ({ ...point }))
    let changed = false

    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!
      const b = path[i + 1]!
      const dx = Math.abs(a.x - b.x)
      const dy = Math.abs(a.y - b.y)

      // Already axis-aligned, or a genuine diagonal — leave both alone.
      if (dx === 0 || dy === 0) continue
      if (dx > MAX_SNAP_DEVIATION && dy > MAX_SNAP_DEVIATION) continue

      // Collapse the smaller deviation. Moving the later point keeps the
      // trace's starting pin exactly where the input put it.
      if (dx < dy) {
        b.x = a.x
      } else {
        b.y = a.y
      }

      changed = true
      straightenedSegmentCount++
    }

    return changed ? { ...trace, tracePath: path } : trace
  })

  return { traces: outputTraces, straightenedSegmentCount }
}
