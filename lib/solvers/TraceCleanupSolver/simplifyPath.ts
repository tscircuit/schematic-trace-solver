interface Point {
  x: number
  y: number
}

/**
 * Simplifies a path by removing redundant collinear points.
 * Points that lie on the same horizontal or vertical line between
 * their neighbors are removed.
 */
export function simplifyPath(path: Point[]): Point[] {
  if (path.length <= 2) return path

  const result: Point[] = [path[0]]

  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    const next = path[i + 1]

    if (!prev || !curr || !next) {
      if (curr) result.push(curr)
      continue
    }

    // Check if curr is collinear between prev and next
    const isCollinearHorizontal =
      Math.abs(prev.y - curr.y) < 1e-6 && Math.abs(curr.y - next.y) < 1e-6
    const isCollinearVertical =
      Math.abs(prev.x - curr.x) < 1e-6 && Math.abs(curr.x - next.x) < 1e-6

    if (!isCollinearHorizontal && !isCollinearVertical) {
      result.push(curr)
    }
  }

  const lastPoint = path[path.length - 1]
  if (lastPoint) {
    result.push(lastPoint)
  }

  return result
}
