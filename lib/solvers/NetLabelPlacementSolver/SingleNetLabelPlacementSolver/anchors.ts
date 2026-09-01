import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const POINT_EPSILON = 1e-6

export function anchorsForSegment(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  // Start, midpoint, end
  return [
    { x: a.x, y: a.y },
    { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    { x: b.x, y: b.y },
  ]
}

export function isVerticalLabelAtSameNetRailTap({
  anchor,
  traces,
}: {
  anchor: { x: number; y: number }
  traces: Array<Pick<SolvedTracePath, "tracePath">>
}): boolean {
  let extendsLeft = false
  let extendsRight = false

  for (const trace of traces) {
    for (let index = 0; index < trace.tracePath.length - 1; index++) {
      const first = trace.tracePath[index]!
      const second = trace.tracePath[index + 1]!
      if (Math.abs(first.y - second.y) > POINT_EPSILON) continue
      if (Math.abs(anchor.y - first.y) > POINT_EPSILON) continue
      const minX = Math.min(first.x, second.x)
      const maxX = Math.max(first.x, second.x)
      if (anchor.x < minX - POINT_EPSILON) continue
      if (anchor.x > maxX + POINT_EPSILON) continue
      if (minX < anchor.x - POINT_EPSILON) {
        extendsLeft = true
      }
      if (maxX > anchor.x + POINT_EPSILON) {
        extendsRight = true
      }

      if (extendsLeft && extendsRight) return true
    }
  }

  return false
}
