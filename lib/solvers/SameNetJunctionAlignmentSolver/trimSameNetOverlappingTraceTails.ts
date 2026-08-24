import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin } from "lib/types/InputProblem"

type Axis = "x" | "y"

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2

const getAxis = (start: Point, end: Point): Axis | null => {
  if (nearlyEqual(start.x, end.x) && !nearlyEqual(start.y, end.y)) return "y"
  if (nearlyEqual(start.y, end.y) && !nearlyEqual(start.x, end.x)) return "x"
  return null
}

const getLength = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const getSharedPin = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
): (InputPin & { chipId: string }) | null => {
  return (
    firstTrace.pins.find((firstPin) =>
      secondTrace.pins.some((secondPin) => secondPin.pinId === firstPin.pinId),
    ) ?? null
  )
}

const orientPathFromPin = ({
  trace,
  pin,
}: {
  trace: SolvedTracePath
  pin: Point
}): Point[] | null => {
  if (pointsEqual(trace.tracePath[0]!, pin)) return trace.tracePath
  if (!pointsEqual(trace.tracePath.at(-1)!, pin)) return null
  return [...trace.tracePath].reverse()
}

const getTrimmedTail = ({
  firstTrace,
  secondTrace,
  sharedPin,
  firstIndex,
  secondIndex,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
  sharedPin: Point
  firstIndex: number
  secondIndex: number
}) => {
  const firstPath = orientPathFromPin({
    trace: firstTrace,
    pin: sharedPin,
  })
  const secondPath = orientPathFromPin({
    trace: secondTrace,
    pin: sharedPin,
  })
  if (!firstPath?.[1] || !secondPath?.[1]) return null

  const firstAxis = getAxis(sharedPin, firstPath[1])
  const secondAxis = getAxis(sharedPin, secondPath[1])
  if (!firstAxis || firstAxis !== secondAxis) return null
  const firstDirection = Math.sign(
    firstPath[1][firstAxis] - sharedPin[firstAxis],
  )
  const secondDirection = Math.sign(
    secondPath[1][secondAxis] - sharedPin[secondAxis],
  )
  if (firstDirection !== secondDirection) return null

  const firstLength = getLength(sharedPin, firstPath[1])
  const secondLength = getLength(sharedPin, secondPath[1])
  const sharedLength = Math.min(firstLength, secondLength)
  if (nearlyEqual(sharedLength, 0)) return null
  if (
    sharedLength > MAX_SHARED_PIN_TAIL_LENGTH &&
    !nearlyEqual(sharedLength, MAX_SHARED_PIN_TAIL_LENGTH)
  )
    return null

  let trunkPath = firstPath
  let branchPath = secondPath
  let branchTrace = secondTrace
  let traceIndex = secondIndex
  if (firstLength > secondLength && !nearlyEqual(firstLength, secondLength)) {
    trunkPath = secondPath
    branchPath = firstPath
    branchTrace = firstTrace
    traceIndex = firstIndex
  }
  let tracePath = simplifyPath([trunkPath[1]!, ...branchPath.slice(1)])
  if (!pointsEqual(branchTrace.tracePath[0]!, sharedPin)) {
    tracePath = [...tracePath].reverse()
  }
  return { tracePath, traceIndex }
}

export const trimSameNetOverlappingTraceTails = ({
  traces,
  eligibleChipIds,
}: {
  traces: SolvedTracePath[]
  eligibleChipIds: Set<string>
}) => {
  const outputTraces = traces.map((trace) => ({ ...trace }))
  let trimmedSameNetOverlapCount = 0

  for (let firstIndex = 0; firstIndex < outputTraces.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < outputTraces.length;
      secondIndex++
    ) {
      const firstTrace = outputTraces[firstIndex]!
      const secondTrace = outputTraces[secondIndex]!
      if (firstTrace.globalConnNetId !== secondTrace.globalConnNetId) continue
      const sharedPin = getSharedPin(firstTrace, secondTrace)
      if (!sharedPin) continue
      if (!eligibleChipIds.has(sharedPin.chipId)) continue

      const trimmedTail = getTrimmedTail({
        firstTrace,
        secondTrace,
        sharedPin,
        firstIndex,
        secondIndex,
      })
      if (!trimmedTail) continue
      outputTraces[trimmedTail.traceIndex] = {
        ...outputTraces[trimmedTail.traceIndex]!,
        tracePath: trimmedTail.tracePath,
      }
      trimmedSameNetOverlapCount++
    }
  }

  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
  }
}
