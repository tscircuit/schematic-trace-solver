import type { Point } from "@tscircuit/math-utils"

const EPS = 1e-6

const onSegment = (p: Point, a: Point, b: Point) =>
  Math.abs((p.x - a.x) * (b.y - a.y) - (p.y - a.y) * (b.x - a.x)) <= EPS &&
  p.x >= Math.min(a.x, b.x) - EPS &&
  p.x <= Math.max(a.x, b.x) + EPS &&
  p.y >= Math.min(a.y, b.y) - EPS &&
  p.y <= Math.max(a.y, b.y) + EPS

/** Minimum wrong-direction vertical travel from a terminal to a rail label.
 * Paths can branch at junctions, and a label can sit in the middle of a segment.
 * Traversal stops at the label: the remainder of a shared wire is irrelevant.
 */
export const getAdverseTravelToRail = ({
  paths,
  source,
  anchors,
  orientation,
  maxVerticalTravel = Infinity,
}: {
  paths: ReadonlyArray<ReadonlyArray<Point>>
  source: Point
  anchors: ReadonlyArray<Point>
  orientation: "y+" | "y-"
  maxVerticalTravel?: number
}) => {
  const segments = paths.flatMap((path) =>
    path.slice(1).map((b, i) => [path[i]!, b] as const),
  )
  const points: Point[] = []
  const addPoint = (p: Point) => {
    const found = points.findIndex(
      (q) => Math.abs(q.x - p.x) <= EPS && Math.abs(q.y - p.y) <= EPS,
    )
    if (found !== -1) return found
    return points.push(p) - 1
  }
  const sourceIndex = addPoint(source)
  const targets = new Set(anchors.map(addPoint))
  for (const path of paths) for (const point of path) addPoint(point)
  // Split same-net crossings as well as explicit vertices and label anchors.
  for (let i = 0; i < segments.length; i++) {
    const [a, b] = segments[i]!
    for (let j = i + 1; j < segments.length; j++) {
      const [c, d] = segments[j]!
      const firstHorizontal = Math.abs(a.y - b.y) <= EPS
      const secondHorizontal = Math.abs(c.y - d.y) <= EPS
      if (firstHorizontal === secondHorizontal) continue
      const intersection = firstHorizontal
        ? { x: c.x, y: a.y }
        : { x: a.x, y: c.y }
      if (onSegment(intersection, a, b) && onSegment(intersection, c, d))
        addPoint(intersection)
    }
  }
  const neighbors = points.map(() => new Set<number>())
  for (const [a, b] of segments) {
    const indices = points
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => onSegment(p, a, b))
      .sort(
        (p, q) =>
          Math.abs(p.p.x - a.x) +
          Math.abs(p.p.y - a.y) -
          Math.abs(q.p.x - a.x) -
          Math.abs(q.p.y - a.y),
      )
    for (let i = 1; i < indices.length; i++) {
      const first = indices[i - 1]!.i,
        second = indices[i]!.i
      neighbors[first]!.add(second)
      neighbors[second]!.add(first)
    }
  }
  // Keep non-dominated alternatives: a path with less adverse travel may
  // consume more of the total vertical budget than another path to the node.
  type State = { node: number; adverse: number; vertical: number }
  const initial: State = { node: sourceIndex, adverse: 0, vertical: 0 }
  const best: State[][] = points.map(() => [])
  best[sourceIndex]!.push(initial)
  const queue: State[] = [initial]
  while (queue.length) {
    queue.sort((a, b) => b.adverse - a.adverse)
    const current = queue.pop()!
    if (!best[current.node]!.includes(current)) continue
    if (targets.has(current.node)) return current.adverse
    for (const neighbor of neighbors[current.node]!) {
      const dy = points[neighbor]!.y - points[current.node]!.y
      const vertical = current.vertical + Math.abs(dy)
      if (vertical > maxVerticalTravel + EPS) continue
      const adverse =
        current.adverse + Math.max(0, orientation === "y+" ? -dy : dy)
      const previous = best[neighbor]!
      if (
        previous.some(
          (state) => state.adverse <= adverse && state.vertical <= vertical,
        )
      )
        continue
      const next = { node: neighbor, adverse, vertical }
      best[neighbor] = previous.filter(
        (state) => !(adverse <= state.adverse && vertical <= state.vertical),
      )
      best[neighbor]!.push(next)
      queue.push(next)
    }
  }
  return Infinity
}
