import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem, SectionId } from "lib/types/InputProblem"

type Axis = "x" | "y"

interface OrientedTrace {
  path: Point[]
  originalPath: Point[]
  reverseOutput: boolean
}

interface TrimmedTail {
  path: Point[]
  trunkPath: Point[]
  traceIndex: number
}

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2
const MAX_HAIRPIN_OFFSET = 0.05
const MIN_HAIRPIN_POINT_COUNT = 6
const FIRST_HAIRPIN_REJOIN_INDEX = 4

const getAxis = (start: Point, end: Point): Axis | null => {
  if (nearlyEqual(start.x, end.x) && !nearlyEqual(start.y, end.y)) return "y"
  if (nearlyEqual(start.y, end.y) && !nearlyEqual(start.x, end.x)) return "x"
  return null
}

const getOtherAxis = (axis: Axis): Axis => {
  if (axis === "x") return "y"
  return "x"
}

const getLength = (start: Point, end: Point) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const getSharedPin = (
  firstTrace: SolvedTracePath,
  secondTrace: SolvedTracePath,
): (InputPin & { chipId: string }) | null => {
  const secondPinIds = new Set(secondTrace.pins.map((pin) => pin.pinId))
  return firstTrace.pins.find((pin) => secondPinIds.has(pin.pinId)) ?? null
}

const orientTraceFromPin = ({
  trace,
  pin,
}: {
  trace: SolvedTracePath
  pin: Point
}): OrientedTrace | null => {
  if (pointsEqual(trace.tracePath[0]!, pin)) {
    return {
      path: trace.tracePath,
      originalPath: trace.tracePath,
      reverseOutput: false,
    }
  }
  if (!pointsEqual(trace.tracePath.at(-1)!, pin)) return null
  return {
    path: [...trace.tracePath].reverse(),
    originalPath: trace.tracePath,
    reverseOutput: true,
  }
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
}): TrimmedTail | null => {
  const first = orientTraceFromPin({
    trace: firstTrace,
    pin: sharedPin,
  })
  const second = orientTraceFromPin({
    trace: secondTrace,
    pin: sharedPin,
  })
  if (!first?.path[1] || !second?.path[1]) return null

  const firstAxis = getAxis(sharedPin, first.path[1])
  const secondAxis = getAxis(sharedPin, second.path[1])
  if (!firstAxis || firstAxis !== secondAxis) return null
  const firstDirection = Math.sign(
    first.path[1][firstAxis] - sharedPin[firstAxis],
  )
  const secondDirection = Math.sign(
    second.path[1][secondAxis] - sharedPin[secondAxis],
  )
  if (firstDirection !== secondDirection) return null

  const firstLength = getLength(sharedPin, first.path[1])
  const secondLength = getLength(sharedPin, second.path[1])
  const sharedLength = Math.min(firstLength, secondLength)
  if (nearlyEqual(sharedLength, 0)) return null
  if (
    sharedLength > MAX_SHARED_PIN_TAIL_LENGTH &&
    !nearlyEqual(sharedLength, MAX_SHARED_PIN_TAIL_LENGTH)
  )
    return null

  let trunk = first
  let branch = second
  let traceIndex = secondIndex
  if (firstLength > secondLength && !nearlyEqual(firstLength, secondLength)) {
    trunk = second
    branch = first
    traceIndex = firstIndex
  }
  let path = simplifyPath([trunk.path[1]!, ...branch.path.slice(1)])
  if (branch.reverseOutput) path = [...path].reverse()
  return { path, trunkPath: trunk.originalPath, traceIndex }
}

const getSegmentAxisAtPoint = (path: Point[], point: Point): Axis | null => {
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    const axis = getAxis(start, end)
    if (!axis) continue
    const otherAxis = getOtherAxis(axis)
    if (!nearlyEqual(point[otherAxis], start[otherAxis])) continue
    if (
      point[axis] >= Math.min(start[axis], end[axis]) &&
      point[axis] <= Math.max(start[axis], end[axis])
    ) {
      return axis
    }
  }
  return null
}

const collapseTightHairpin = ({
  branchPath,
  trunkPath,
  obstacles,
}: {
  branchPath: Point[]
  trunkPath: Point[]
  obstacles: ObstacleRect[]
}): Point[] | null => {
  if (branchPath.length < MIN_HAIRPIN_POINT_COUNT) return null
  const junction = branchPath[0]!
  const outwardEnd = branchPath[1]!
  const offsetEnd = branchPath[2]!
  const trunkAxis = getSegmentAxisAtPoint(trunkPath, junction)
  if (!trunkAxis) return null
  const offsetAxis = getOtherAxis(trunkAxis)
  if (
    getAxis(junction, outwardEnd) !== trunkAxis ||
    getAxis(outwardEnd, offsetEnd) !== offsetAxis ||
    getLength(outwardEnd, offsetEnd) > MAX_HAIRPIN_OFFSET
  ) {
    return null
  }

  const snappedOutwardEnd = { ...outwardEnd }
  snappedOutwardEnd[offsetAxis] = junction[offsetAxis]
  for (
    let rejoinIndex = FIRST_HAIRPIN_REJOIN_INDEX;
    rejoinIndex < branchPath.length;
    rejoinIndex++
  ) {
    if (
      !nearlyEqual(branchPath[rejoinIndex]![trunkAxis], outwardEnd[trunkAxis])
    ) {
      continue
    }
    const shortcut = simplifyPath([
      junction,
      snappedOutwardEnd,
      ...branchPath.slice(rejoinIndex),
    ])
    if (!isPathCollidingWithObstacles(shortcut, obstacles)) return shortcut
  }
  return null
}

export const trimSameNetOverlappingTraceTails = ({
  traces,
  inputProblem,
  alignedSectionIds,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  alignedSectionIds: Set<SectionId>
}) => {
  const outputTraces = traces.map((trace) => ({ ...trace }))
  let trimmedSameNetOverlapCount = 0
  let collapsedSameNetHairpinCount = 0
  const obstacles = getObstacleRects(inputProblem)

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
      const sharedPinChip = inputProblem.chips.find(
        (chip) => chip.chipId === sharedPin.chipId,
      )
      if (!sharedPinChip?.sectionId) continue
      if (!alignedSectionIds.has(sharedPinChip.sectionId)) continue

      const trimmedTail = getTrimmedTail({
        firstTrace,
        secondTrace,
        sharedPin,
        firstIndex,
        secondIndex,
      })
      if (!trimmedTail) continue
      const collapsedPath = collapseTightHairpin({
        branchPath: trimmedTail.path,
        trunkPath: trimmedTail.trunkPath,
        obstacles,
      })
      let tracePath = trimmedTail.path
      if (collapsedPath) {
        tracePath = collapsedPath
        collapsedSameNetHairpinCount++
      }
      outputTraces[trimmedTail.traceIndex] = {
        ...outputTraces[trimmedTail.traceIndex]!,
        tracePath,
      }
      trimmedSameNetOverlapCount++
    }
  }

  if (collapsedSameNetHairpinCount === 0) {
    return {
      traces,
      trimmedSameNetOverlapCount: 0,
      collapsedSameNetHairpinCount: 0,
    }
  }
  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
    collapsedSameNetHairpinCount,
  }
}
