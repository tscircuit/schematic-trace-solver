import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export function segmentIntersectsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: { minX: number; minY: number; maxX: number; maxY: number },
  EPS = 1e-9,
): boolean {
  const isVert = Math.abs(p1.x - p2.x) < EPS
  const isHorz = Math.abs(p1.y - p2.y) < EPS
  if (isVert && isHorz) return false

  if (isVert) {
    const x = p1.x
    if (x < rect.minX - EPS || x > rect.maxX + EPS) return false
    const segMinY = Math.min(p1.y, p2.y)
    const segMaxY = Math.max(p1.y, p2.y)
    const overlap = Math.min(segMaxY, rect.maxY) - Math.max(segMinY, rect.minY)
    return overlap > EPS
  }

  if (isHorz) {
    const y = p1.y
    if (y < rect.minY - EPS || y > rect.maxY + EPS) return false
    const segMinX = Math.min(p1.x, p2.x)
    const segMaxX = Math.max(p1.x, p2.x)
    const overlap = Math.min(segMaxX, rect.maxX) - Math.max(segMinX, rect.minX)
    return overlap > EPS
  }

  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const tx1 = (rect.minX - p1.x) / dx
  const tx2 = (rect.maxX - p1.x) / dx
  const ty1 = (rect.minY - p1.y) / dy
  const ty2 = (rect.maxY - p1.y) / dy

  const tMin = Math.max(0, Math.min(tx1, tx2), Math.min(ty1, ty2))
  const tMax = Math.min(1, Math.max(tx1, tx2), Math.max(ty1, ty2))
  if (tMax <= tMin) return false

  const clippedLength = (tMax - tMin) * Math.hypot(dx, dy)
  return clippedLength > EPS
}

export function rectIntersectsAnyTrace(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>,
  hostPathId?: MspConnectionPairId,
  hostSegIndex?: number,
):
  | {
      hasIntersection: true
      mspPairId: MspConnectionPairId
      segIndex: number
    }
  | { hasIntersection: false } {
  for (const [pairId, solved] of Object.entries(inputTraceMap)) {
    const pts = solved.tracePath
    for (let i = 0; i < pts.length - 1; i++) {
      if (pairId === hostPathId && i === hostSegIndex) continue
      if (segmentIntersectsRect(pts[i]!, pts[i + 1]!, bounds))
        return { hasIntersection: true, mspPairId: pairId, segIndex: i }
    }
  }
  return { hasIntersection: false }
}
