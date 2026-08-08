import { distance } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

const GROUND_NET_ID = "GND"
const INTERSECTION_ENDPOINT_TOLERANCE = 1e-6

const oppositeFacingDirection: Record<FacingDirection, FacingDirection> = {
  "x+": "x-",
  "x-": "x+",
  "y+": "y-",
  "y-": "y+",
}

const tracePinsFaceOppositeDirections = (trace: SolvedTracePath): boolean => {
  const [firstPin, secondPin] = trace.pins
  if (!firstPin._facingDirection || !secondPin._facingDirection) return false
  return (
    oppositeFacingDirection[firstPin._facingDirection] ===
    secondPin._facingDirection
  )
}

const traceIsExplicitDirectConnection = ({
  inputProblem,
  trace,
}: {
  inputProblem: InputProblem
  trace: SolvedTracePath
}): boolean => {
  const [firstPin, secondPin] = trace.pins
  return inputProblem.directConnections.some(({ pinIds }) => {
    const connectsForward =
      pinIds[0] === firstPin.pinId && pinIds[1] === secondPin.pinId
    const connectsBackward =
      pinIds[0] === secondPin.pinId && pinIds[1] === firstPin.pinId
    return connectsForward || connectsBackward
  })
}

export const tracePathsHaveInteriorIntersection = ({
  firstTracePath,
  secondTracePath,
}: {
  firstTracePath: SolvedTracePath["tracePath"]
  secondTracePath: SolvedTracePath["tracePath"]
}): boolean => {
  for (
    let firstSegmentIndex = 0;
    firstSegmentIndex < firstTracePath.length - 1;
    firstSegmentIndex++
  ) {
    const firstSegmentStart = firstTracePath[firstSegmentIndex]!
    const firstSegmentEnd = firstTracePath[firstSegmentIndex + 1]!

    for (
      let secondSegmentIndex = 0;
      secondSegmentIndex < secondTracePath.length - 1;
      secondSegmentIndex++
    ) {
      const secondSegmentStart = secondTracePath[secondSegmentIndex]!
      const secondSegmentEnd = secondTracePath[secondSegmentIndex + 1]!
      const intersection = getSegmentIntersection(
        firstSegmentStart,
        firstSegmentEnd,
        secondSegmentStart,
        secondSegmentEnd,
      )
      if (!intersection) continue

      const intersectionTouchesEndpoint =
        distance(intersection, firstSegmentStart) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, firstSegmentEnd) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, secondSegmentStart) <=
          INTERSECTION_ENDPOINT_TOLERANCE ||
        distance(intersection, secondSegmentEnd) <=
          INTERSECTION_ENDPOINT_TOLERANCE
      if (!intersectionTouchesEndpoint) return true
    }
  }

  return false
}

export const getGroundTracesToReplaceWithLabels = ({
  inputProblem,
  traces,
}: {
  inputProblem: InputProblem
  traces: SolvedTracePath[]
}): SolvedTracePath[] => {
  return traces.filter((groundTrace) => {
    if (groundTrace.userNetId !== GROUND_NET_ID) return false
    if (groundTrace.pins[0].chipId !== groundTrace.pins[1].chipId) return false
    if (!tracePinsFaceOppositeDirections(groundTrace)) return false
    if (traceIsExplicitDirectConnection({ inputProblem, trace: groundTrace })) {
      return false
    }

    return traces.some((otherTrace) => {
      if (otherTrace.globalConnNetId === groundTrace.globalConnNetId) {
        return false
      }
      return tracePathsHaveInteriorIntersection({
        firstTracePath: groundTrace.tracePath,
        secondTracePath: otherTrace.tracePath,
      })
    })
  })
}
