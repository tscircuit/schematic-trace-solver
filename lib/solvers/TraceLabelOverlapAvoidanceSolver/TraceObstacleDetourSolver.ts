import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { Bounds, Point } from "@tscircuit/math-utils"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"

const EPS = 1e-6
const pathLength = (path: Point[]) =>
  path
    .slice(1)
    .reduce(
      (sum, p, i) =>
        sum + Math.abs(p.x - path[i]!.x) + Math.abs(p.y - path[i]!.y),
      0,
    )
const intersects = (path: Point[], bounds: Bounds) =>
  path.slice(1).some((p, i) => segmentIntersectsRect(path[i]!, p, bounds))

/** Move an interior leg, or detour only the part of a leg crossing a rectangle. */
export const generateObstacleDetours = (
  path: Point[],
  bounds: Bounds,
  clearance: number,
): Point[][] => {
  const candidates: Point[][] = []
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!,
      b = path[i + 1]!
    if (!segmentIntersectsRect(a, b, bounds)) continue
    const horizontal = Math.abs(a.y - b.y) < EPS
    const along = horizontal ? "x" : "y"
    const across = horizontal ? "y" : "x"
    const obstacleLow = horizontal ? bounds.minX : bounds.minY
    const obstacleHigh = horizontal ? bounds.maxX : bounds.maxY
    // A short endpoint leg may have less than the preferred lead-in distance.
    // Place its bend inside the available gap, retaining a nonzero pin exit.
    const low = Math.max(
      obstacleLow - clearance,
      (Math.min(a[along], b[along]) + obstacleLow) / 2,
    )
    const high = Math.min(
      obstacleHigh + clearance,
      (Math.max(a[along], b[along]) + obstacleHigh) / 2,
    )
    const sides = horizontal
      ? [bounds.minY - clearance, bounds.maxY + clearance]
      : [bounds.minX - clearance, bounds.maxX + clearance]
    for (const side of sides) {
      if (
        i > 0 &&
        i + 2 < path.length &&
        Math.abs(path[i - 1]![along] - a[along]) < EPS &&
        Math.abs(path[i + 2]![along] - b[along]) < EPS
      ) {
        candidates.push(
          path.map((p, index) =>
            index === i || index === i + 1 ? { ...p, [across]: side } : p,
          ),
        )
      }
      if (
        low <= Math.min(a[along], b[along]) + EPS ||
        high >= Math.max(a[along], b[along]) - EPS
      )
        continue
      const entry = { ...a, [along]: a[along] < b[along] ? low : high }
      const exit = { ...b, [along]: a[along] < b[along] ? high : low }
      candidates.push([
        ...path.slice(0, i + 1),
        entry,
        { ...entry, [across]: side },
        { ...exit, [across]: side },
        exit,
        ...path.slice(i + 1),
      ])
    }
  }
  return candidates
}

/**
 * Resolve interacting obstacles after a single-label detour fails. Each
 * expansion uses the next actual obstruction, so an unchanged text collision
 * elsewhere on a wire cannot make every local label candidate fail forever.
 */
export class TraceObstacleDetourSolver extends BaseSolver {
  solvedTracePath: Point[] | null = null
  private queue: Point[][]
  private visited = new Set<string>()
  private protectedPoints: Point[]

  constructor(
    private input: {
      trace: SolvedTracePath
      obstacles: Bounds[]
      otherNetTraces: SolvedTracePath[]
      sameNetTraces: SolvedTracePath[]
      clearance: number
      pinPositions?: Point[]
    },
  ) {
    super()
    this.MAX_ITERATIONS = 200
    this.queue = [simplifyPath(input.trace.tracePath)]
    this.protectedPoints = [
      ...input.sameNetTraces.flatMap((trace) => trace.tracePath),
      ...(input.pinPositions ?? []),
    ].filter((point) => tracePathContainsPoint(input.trace.tracePath, point))
    for (const trace of input.sameNetTraces) {
      for (let i = 1; i < trace.tracePath.length; i++) {
        for (let j = 1; j < input.trace.tracePath.length; j++) {
          const intersection = getSegmentIntersection(
            trace.tracePath[i - 1]!,
            trace.tracePath[i]!,
            input.trace.tracePath[j - 1]!,
            input.trace.tracePath[j]!,
          )
          if (intersection) this.protectedPoints.push(intersection)
        }
      }
    }
  }

  private getBlocker(path: Point[]): Bounds | undefined {
    const obstacle = this.input.obstacles.find((bounds) =>
      intersects(path, bounds),
    )
    if (obstacle) return obstacle
    for (const trace of this.input.otherNetTraces) {
      for (let i = 1; i < trace.tracePath.length; i++) {
        const a = trace.tracePath[i - 1]!,
          b = trace.tracePath[i]!
        if (
          !doesPathCoincideWithTraces(path, [{ ...trace, tracePath: [a, b] }])
        )
          continue
        return {
          minX: Math.min(a.x, b.x) - EPS,
          maxX: Math.max(a.x, b.x) + EPS,
          minY: Math.min(a.y, b.y) - EPS,
          maxY: Math.max(a.y, b.y) + EPS,
        }
      }
    }
    return undefined
  }

  override _step() {
    const path = this.queue.shift()
    if (!path) {
      this.failed = true
      return
    }
    const blocker = this.getBlocker(path)
    if (!blocker) {
      this.solvedTracePath = path
      this.solved = true
      return
    }
    for (const candidate of generateObstacleDetours(
      path,
      blocker,
      this.input.clearance,
    )) {
      const simple = simplifyPath(candidate)
      const key = JSON.stringify(simple)
      if (this.visited.has(key)) continue
      this.visited.add(key)
      if (
        !this.protectedPoints.every((point) =>
          tracePathContainsPoint(simple, point),
        )
      )
        continue
      // Preserve both fixed endpoints and the direction in which each pin exits.
      const original = this.input.trace.tracePath
      const preservesExit = (a: Point, b: Point, c: Point, d: Point) =>
        (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y) > EPS
      if (
        !preservesExit(original[0]!, original[1]!, simple[0]!, simple[1]!) ||
        !preservesExit(
          original.at(-1)!,
          original.at(-2)!,
          simple.at(-1)!,
          simple.at(-2)!,
        )
      )
        continue
      this.queue.push(simple)
    }
    this.queue.sort(
      (a, b) => a.length - b.length || pathLength(a) - pathLength(b),
    )
  }
}
