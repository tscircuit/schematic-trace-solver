import type { Point } from "@tscircuit/math-utils"

/**
 * Recovered net-label traces are built between pins that the candidate filter
 * accepts as "aligned" within MAX_*_RECOVERY_PERPENDICULAR_OFFSET. Those pins
 * are only approximately aligned, so the routed path can contain a segment that
 * is off-axis by up to that tolerance, which renders as a visibly slanted wire.
 *
 * Snap any segment whose perpendicular drift is within the tolerance onto a
 * single axis so the emitted path stays strictly orthogonal. Prefer moving an
 * interior point so a pin is not pulled off its port; on the first segment the
 * start point is a pin, so the end point moves instead.
 */
export const straightenRecoveredTracePath = (
  tracePath: Point[],
  maxPerpendicularOffset: number,
): Point[] => {
  if (tracePath.length < 2) return tracePath

  const path = tracePath.map((point) => ({ ...point }))

  for (let index = 0; index + 1 < path.length; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    const xDrift = Math.abs(start.x - end.x)
    const yDrift = Math.abs(start.y - end.y)

    // Already axis-aligned, or too skewed to be an alignment artifact.
    if (xDrift === 0 || yDrift === 0) continue
    const drift = Math.min(xDrift, yDrift)
    if (drift > maxPerpendicularOffset) continue

    // Prefer moving an interior point, which cannot pull a pin off its port.
    // On the very first segment the start point is a pin, so move the end.
    const movesStartPoint = index > 0
    if (xDrift > yDrift) {
      if (movesStartPoint) start.y = end.y
      else end.y = start.y
    } else if (movesStartPoint) {
      start.x = end.x
    } else {
      end.x = start.x
    }
  }

  return path
}
