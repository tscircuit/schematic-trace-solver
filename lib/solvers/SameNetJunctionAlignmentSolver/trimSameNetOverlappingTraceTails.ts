import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputProblem, SectionId } from "lib/types/InputProblem"

type Axis = "x" | "y"

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2
const MAX_HAIRPIN_OFFSET = 0.05
const MIN_HAIRPIN_POINT_COUNT = 6
const HAIRPIN_TRAILING_POINT_COUNT = 3

const getAxis = (start: Point, end: Point): Axis | null => {
  if (nearlyEqual(start.x, end.x) && !nearlyEqual(start.y, end.y)) return "y"
  if (nearlyEqual(start.y, end.y) && !nearlyEqual(start.x, end.x)) return "x"
  return null
}

const getLength = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const orientPathFromPin = (
  trace: SolvedTracePath,
  pin: Point,
): Point[] | null => {
  if (pointsEqual(trace.tracePath[0]!, pin)) return trace.tracePath
  if (!pointsEqual(trace.tracePath.at(-1)!, pin)) return null
  return [...trace.tracePath].reverse()
}

const getTailRewrite = ({
  firstTrace,
  secondTrace,
  sharedPin,
  firstIndex,
  secondIndex,
  obstacles,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
  sharedPin: Point
  firstIndex: number
  secondIndex: number
  obstacles: ReturnType<typeof getObstacleRects>
}) => {
  const firstPath = orientPathFromPin(firstTrace, sharedPin)
  const secondPath = orientPathFromPin(secondTrace, sharedPin)
  if (!firstPath?.[1] || !secondPath?.[1]) return null

  // V1 handles only short tails leaving the shared pin in the same direction.
  const firstAxis = getAxis(sharedPin, firstPath[1])
  const secondAxis = getAxis(sharedPin, secondPath[1])
  if (!firstAxis || firstAxis !== secondAxis) return null
  if (
    Math.sign(firstPath[1][firstAxis] - sharedPin[firstAxis]) !==
    Math.sign(secondPath[1][secondAxis] - sharedPin[secondAxis])
  )
    return null

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
  let trunkTrace = firstTrace
  let branchPath = secondPath
  let branchTrace = secondTrace
  let traceIndex = secondIndex
  if (firstLength > secondLength && !nearlyEqual(firstLength, secondLength)) {
    trunkPath = secondPath
    trunkTrace = secondTrace
    branchPath = firstPath
    branchTrace = firstTrace
    traceIndex = firstIndex
  }

  let trunkAxis: Axis | null = firstAxis
  if (!pointsEqual(trunkTrace.tracePath[0]!, sharedPin)) {
    trunkAxis = getAxis(trunkPath[1]!, trunkPath[2]!)
  }
  let path = simplifyPath([trunkPath[1]!, ...branchPath.slice(1)])
  if (!pointsEqual(branchTrace.tracePath[0]!, sharedPin)) {
    path = [...path].reverse()
  }

  // Keep the tail trim provisional unless this pair also has a safe hairpin.
  if (!trunkAxis || path.length < MIN_HAIRPIN_POINT_COUNT) {
    return { path, traceIndex, collapsedHairpin: false }
  }
  const junction = path[0]!
  const outwardEnd = path[1]!
  const offsetEnd = path[2]!
  let offsetAxis: Axis = "x"
  if (trunkAxis === "x") offsetAxis = "y"
  if (
    getAxis(junction, outwardEnd) !== trunkAxis ||
    getAxis(outwardEnd, offsetEnd) !== offsetAxis ||
    getLength(outwardEnd, offsetEnd) > MAX_HAIRPIN_OFFSET
  ) {
    return { path, traceIndex, collapsedHairpin: false }
  }

  const snappedOutwardEnd = { ...outwardEnd }
  snappedOutwardEnd[offsetAxis] = junction[offsetAxis]
  // V1 handles a hairpin that rejoins three points before the trace end.
  const rejoinIndex = path.length - HAIRPIN_TRAILING_POINT_COUNT
  if (!nearlyEqual(path[rejoinIndex]![trunkAxis], outwardEnd[trunkAxis])) {
    return { path, traceIndex, collapsedHairpin: false }
  }
  const shortcut = simplifyPath([
    junction,
    snappedOutwardEnd,
    ...path.slice(rejoinIndex),
  ])
  if (!isPathCollidingWithObstacles(shortcut, obstacles)) {
    return { path: shortcut, traceIndex, collapsedHairpin: true }
  }
  return { path, traceIndex, collapsedHairpin: false }
}

export const trimSameNetOverlappingTraceTails = ({
  traces,
  inputProblem,
  alignedSectionId,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  alignedSectionId: SectionId | null
}) => {
  const unchangedResult = {
    traces,
    trimmedSameNetOverlapCount: 0,
  }
  if (!alignedSectionId) return unchangedResult

  const outputTraces = traces.map((trace) => ({ ...trace }))
  const obstacles = getObstacleRects(inputProblem)
  let trimmedSameNetOverlapCount = 0
  let collapsedHairpin = false

  for (let firstIndex = 0; firstIndex < outputTraces.length; firstIndex++) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < outputTraces.length;
      secondIndex++
    ) {
      const firstTrace = outputTraces[firstIndex]!
      const secondTrace = outputTraces[secondIndex]!
      if (firstTrace.globalConnNetId !== secondTrace.globalConnNetId) continue
      const secondPinIds = new Set(secondTrace.pins.map((pin) => pin.pinId))
      const sharedPin = firstTrace.pins.find((pin) =>
        secondPinIds.has(pin.pinId),
      )
      if (!sharedPin) continue
      const sharedPinChip = inputProblem.chips.find(
        (chip) => chip.chipId === sharedPin.chipId,
      )
      if (sharedPinChip?.sectionId !== alignedSectionId) continue

      const rewrite = getTailRewrite({
        firstTrace,
        secondTrace,
        sharedPin,
        firstIndex,
        secondIndex,
        obstacles,
      })
      if (!rewrite) continue
      outputTraces[rewrite.traceIndex] = {
        ...outputTraces[rewrite.traceIndex]!,
        tracePath: rewrite.path,
      }
      trimmedSameNetOverlapCount++
      if (rewrite.collapsedHairpin) collapsedHairpin = true
    }
  }

  // Avoid partial cleanup: without a safe hairpin, return every original path.
  if (!collapsedHairpin) return unchangedResult
  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
  }
}
