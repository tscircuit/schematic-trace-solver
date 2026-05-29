import type { Point } from "@tscircuit/math-utils"

export const simplifyTracePath = (path: Point[]): Point[] => {
  if (path.length <= 1) return path
  const EPS = 1e-6

  // 1. Remove duplicate points
  const noDuplicates: Point[] = [path[0]]
  for (let i = 1; i < path.length; i++) {
    const prev = noDuplicates[noDuplicates.length - 1]
    const curr = path[i]
    if (Math.abs(prev.x - curr.x) > EPS || Math.abs(prev.y - curr.y) > EPS) {
      noDuplicates.push(curr)
    }
  }

  if (noDuplicates.length <= 2) return noDuplicates

  // 2. Remove co-linear points
  const simplified: Point[] = [noDuplicates[0]]
  for (let i = 1; i < noDuplicates.length - 1; i++) {
    const prev = simplified[simplified.length - 1]
    const curr = noDuplicates[i]
    const next = noDuplicates[i + 1]

    const isColinear =
      (Math.abs(prev.x - curr.x) < EPS && Math.abs(curr.x - next.x) < EPS) ||
      (Math.abs(prev.y - curr.y) < EPS && Math.abs(curr.y - next.y) < EPS)

    if (!isColinear) {
      simplified.push(curr)
    }
  }

  simplified.push(noDuplicates[noDuplicates.length - 1])
  return simplified
}
