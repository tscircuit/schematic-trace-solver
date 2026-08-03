import type { Point } from "@tscircuit/math-utils"
import { calculateElbow } from "calculate-elbow"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { calculateDirectShortPath } from "./calculateDirectShortPath"
import { findFirstCollision } from "./collisions"
import type { ObstacleRect } from "./rect"

type TracePin = MspConnectionPair["pins"][number]

const calculateElbowForPins = ({
  pin1,
  pin2,
  overshoot,
}: {
  pin1: TracePin
  pin2: TracePin
  overshoot: number
}) =>
  calculateElbow(
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
    { overshoot },
  )

const getPathLength = (path: Point[]) => {
  let length = 0
  for (let i = 0; i < path.length - 1; i++) {
    length +=
      Math.abs(path[i + 1]!.x - path[i]!.x) +
      Math.abs(path[i + 1]!.y - path[i]!.y)
  }
  return length
}

const pinsFaceEachOther = ({
  pin1,
  pin2,
}: {
  pin1: TracePin
  pin2: TracePin
}) => {
  const xDistance = pin2.x - pin1.x
  const yDistance = pin2.y - pin1.y
  if (Math.abs(xDistance) >= Math.abs(yDistance)) {
    return xDistance > 0
      ? pin1._facingDirection === "x+" && pin2._facingDirection === "x-"
      : pin1._facingDirection === "x-" && pin2._facingDirection === "x+"
  }
  return yDistance > 0
    ? pin1._facingDirection === "y+" && pin2._facingDirection === "y-"
    : pin1._facingDirection === "y-" && pin2._facingDirection === "y+"
}

export const getInitialTracePathCandidates = ({
  pin1,
  pin2,
}: {
  pin1: TracePin
  pin2: TracePin
}) => {
  const routingDistance = Math.abs(pin1.x - pin2.x) + Math.abs(pin1.y - pin2.y)

  return {
    directShortPath: calculateDirectShortPath(pin1, pin2),
    defaultElbow: calculateElbowForPins({ pin1, pin2, overshoot: 0.2 }),
    adaptiveElbow: calculateElbowForPins({
      pin1,
      pin2,
      overshoot: Math.min(0.2, Math.max(0.02, routingDistance / 4)),
    }),
    routingDistance,
  }
}

export const getInitialTracePath = ({
  pin1,
  pin2,
  obstacles,
}: {
  pin1: TracePin
  pin2: TracePin
  obstacles: ObstacleRect[]
}) => {
  const { directShortPath, defaultElbow, adaptiveElbow, routingDistance } =
    getInitialTracePathCandidates({ pin1, pin2 })
  const adaptiveElbowIsShorter =
    getPathLength(adaptiveElbow) < getPathLength(defaultElbow)
  const defaultElbowBacktracks =
    getPathLength(defaultElbow) > routingDistance + 1e-9
  const shouldUseAdaptiveElbow =
    findFirstCollision(adaptiveElbow, obstacles) === null &&
    ((pinsFaceEachOther({ pin1, pin2 }) &&
      defaultElbowBacktracks &&
      adaptiveElbowIsShorter) ||
      findFirstCollision(defaultElbow, obstacles) !== null)

  return {
    path: directShortPath
      ? directShortPath
      : shouldUseAdaptiveElbow
        ? adaptiveElbow
        : defaultElbow,
    isDirectShortPath: directShortPath !== null,
  }
}
