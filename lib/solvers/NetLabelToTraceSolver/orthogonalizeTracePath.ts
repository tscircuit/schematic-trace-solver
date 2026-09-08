import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-9

export const isAxisAlignedSegment = (start: Point, end: Point, eps = EPS) =>
  Math.abs(start.x - end.x) < eps || Math.abs(start.y - end.y) < eps

const compactConsecutivePoints = (path: Point[]) =>
  path.filter((point, index) => {
    const previousPoint = path[index - 1]
    return (
      !previousPoint ||
      Math.abs(point.x - previousPoint.x) >= EPS ||
      Math.abs(point.y - previousPoint.y) >= EPS
    )
  })

export const orthogonalizeTracePath = (
  path: Point[],
  preferHorizontalFirst: boolean,
): Point[] => {
  if (path.length < 2) return path
  const result: Point[] = [{ ...path[0]! }]
  for (let index = 1; index < path.length; index++) {
    const previous = result[result.length - 1]!
    const current = path[index]!
    if (isAxisAlignedSegment(previous, current)) {
      result.push({ ...current })
      continue
    }
    const corner = preferHorizontalFirst
      ? { x: current.x, y: previous.y }
      : { x: previous.x, y: current.y }
    result.push(corner, { ...current })
  }
  return compactConsecutivePoints(result)
}

const pathHasLongerHorizontalSpan = (path: Point[]) => {
  let dx = 0
  let dy = 0
  for (let index = 0; index < path.length - 1; index++) {
    dx += Math.abs(path[index + 1]!.x - path[index]!.x)
    dy += Math.abs(path[index + 1]!.y - path[index]!.y)
  }
  return dx >= dy
}

const pathKey = (path: Point[]) =>
  path.map((point) => `${point.x},${point.y}`).join("|")

export const orthogonalizeTracePathCandidates = (path: Point[]): Point[][] => {
  const preferHorizontalFirst = pathHasLongerHorizontalSpan(path)
  const unique: Point[][] = []
  const seen = new Set<string>()
  for (const candidate of [
    orthogonalizeTracePath(path, preferHorizontalFirst),
    orthogonalizeTracePath(path, !preferHorizontalFirst),
  ]) {
    const key = pathKey(candidate)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(candidate)
  }
  return unique
}
