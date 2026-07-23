import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { FacingDirection } from "lib/utils/dir"
import { calculateElbow } from "calculate-elbow"

const MAX_SHORT_TRACE_DISTANCE = 0.15
const SHORT_TRACE_OVERSHOOT = MAX_SHORT_TRACE_DISTANCE / 7.5
const FALLBACK_ELBOW_MAX_OVERSHOOT = 0.2

export function segmentDirection(
  from: Point,
  to: Point,
): FacingDirection | null {
  if (to.x > from.x) return "x+"
  if (to.x < from.x) return "x-"
  if (to.y > from.y) return "y+"
  if (to.y < from.y) return "y-"
  return null
}

export function pathMatchesPinDirections({
  path,
  pin1,
  pin2,
}: {
  path: Point[]
  pin1: MspConnectionPair["pins"][number]
  pin2: MspConnectionPair["pins"][number]
}): boolean {
  const firstDirection = segmentDirection(path[0]!, path[1]!)
  const lastDirection = segmentDirection(
    path[path.length - 1]!,
    path[path.length - 2]!,
  )

  return (
    firstDirection === pin1._facingDirection &&
    lastDirection === pin2._facingDirection
  )
}

/**
 * Calculates a short orthogonal (perpendicular) route when the source and destination pins
 * are oriented at a 90-degree angle to one another (e.g., one faces X and the other faces Y).
 * It creates a minimal step-out to avoid overlapping pin bodies.
 */
export function calculateShortOrthogonalRoute(
  pin1: MspConnectionPair["pins"][number],
  pin2: MspConnectionPair["pins"][number],
): Point[] | null {
  // If pins share an axis, an orthogonal 3-segment route is unnecessary
  if (pin1.x === pin2.x || pin1.y === pin2.y) return null

  const firstDir = pin1._facingDirection
  const lastDir = pin2._facingDirection

  const start = { x: pin1.x, y: pin1.y }
  const end = { x: pin2.x, y: pin2.y }

  let path: Point[] | null = null

  // Handle case where pin1 faces vertically and pin2 faces horizontally
  if (firstDir?.startsWith("y") && lastDir?.startsWith("x")) {
    let yOffset = -SHORT_TRACE_OVERSHOOT
    if (firstDir === "y+") {
      yOffset = SHORT_TRACE_OVERSHOOT
    }
    const routeY = start.y + yOffset
    const routeX = (start.x + end.x) / 2
    path = [
      start,
      { x: start.x, y: routeY },
      { x: routeX, y: routeY },
      { x: routeX, y: end.y },
      end,
    ]
  }
  // Handle case where pin1 faces horizontally and pin2 faces vertically
  else if (firstDir?.startsWith("x") && lastDir?.startsWith("y")) {
    let xOffset = -SHORT_TRACE_OVERSHOOT
    if (firstDir === "x+") {
      xOffset = SHORT_TRACE_OVERSHOOT
    }
    const routeX = start.x + xOffset
    const routeY = (start.y + end.y) / 2
    path = [
      start,
      { x: routeX, y: start.y },
      { x: routeX, y: routeY },
      { x: end.x, y: routeY },
      end,
    ]
  }

  if (!path) return null

  if (pathMatchesPinDirections({ path, pin1, pin2 })) {
    return path
  }
  return null
}

/**
 * Attempts to calculate a direct route between two pins if they are very close together.
 * This prevents complex routing logic from taking over for trivial connections.
 */
export function calculateDirectShortPath(
  pin1: MspConnectionPair["pins"][number],
  pin2: MspConnectionPair["pins"][number],
): Point[] | null {
  const routingDistance = Math.abs(pin1.x - pin2.x) + Math.abs(pin1.y - pin2.y)

  // If the distance is too large, fallback to the standard complex routing solver
  if (routingDistance > MAX_SHORT_TRACE_DISTANCE) return null

  const start = { x: pin1.x, y: pin1.y }
  const end = { x: pin2.x, y: pin2.y }

  // First, try a simple orthogonal route if the pins are facing perpendicular directions
  const orthogonalRoute = calculateShortOrthogonalRoute(pin1, pin2)
  if (orthogonalRoute) return orthogonalRoute

  let candidatePaths: Point[][] = []

  // If the pins are completely offset (neither perfectly aligned horizontally nor vertically),
  // we evaluate standard two-segment L-shaped routes.
  if (pin1.x !== pin2.x && pin1.y !== pin2.y) {
    candidatePaths = [
      [start, { x: pin2.x, y: pin1.y }, end],
      [start, { x: pin1.x, y: pin2.y }, end],
    ]
  } else {
    // If they are perfectly aligned, try a straight line
    candidatePaths = [[start, end]]
  }

  // Return the first candidate that matches the facing direction requirements of the pins
  for (const path of candidatePaths) {
    if (pathMatchesPinDirections({ path, pin1, pin2 })) return path
  }

  // If simple paths fail, compute a slightly overshoot-based elbow routing as a final short-trace fallback
  return calculateElbow(
    {
      x: pin1.x,
      y: pin1.y,
      facingDirection: pin1._facingDirection!,
    },
    {
      x: pin2.x,
      y: pin2.y,
      facingDirection: pin2._facingDirection!,
    },
    {
      overshoot: Math.min(
        FALLBACK_ELBOW_MAX_OVERSHOOT,
        Math.max(SHORT_TRACE_OVERSHOOT, routingDistance / 4),
      ),
    },
  )
}
