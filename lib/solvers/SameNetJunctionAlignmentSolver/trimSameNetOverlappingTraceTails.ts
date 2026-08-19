import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import {
  getObstacleRects,
  type ObstacleRect,
} from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  isHorizontal,
  isVertical,
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem, SectionId } from "lib/types/InputProblem"

interface TrimmedTail {
  path: Point[]
  trunkPath: Point[]
  trimFirstTrace: boolean
}

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2
const MAX_HAIRPIN_OFFSET = 0.05
const MIN_HAIRPIN_POINT_COUNT = 6

const getSharedPin = ({
  firstTrace,
  secondTrace,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
}): (InputPin & { chipId: string }) | null => {
  const secondPinIds = new Set(secondTrace.pins.map((pin) => pin.pinId))
  return firstTrace.pins.find((pin) => secondPinIds.has(pin.pinId)) ?? null
}

const orientPathFromPin = ({
  trace,
  pin,
}: {
  trace: SolvedTracePath
  pin: Point
}) => {
  if (pointsEqual(trace.tracePath[0]!, pin)) {
    return { path: trace.tracePath, reverseOutput: false }
  }
  if (!pointsEqual(trace.tracePath.at(-1)!, pin)) return null
  return { path: [...trace.tracePath].reverse(), reverseOutput: true }
}

const getUnitDirection = ({ start, end }: { start: Point; end: Point }) => {
  if (isVertical(start, end) && !nearlyEqual(start.y, end.y)) {
    return { x: 0, y: Math.sign(end.y - start.y) }
  }
  if (isHorizontal(start, end) && !nearlyEqual(start.x, end.x)) {
    return { x: Math.sign(end.x - start.x), y: 0 }
  }
  return null
}

const getLength = ({ start, end }: { start: Point; end: Point }) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const getTrimmedTail = ({
  firstTrace,
  secondTrace,
  sharedPin,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
  sharedPin: Point
}): TrimmedTail | null => {
  const first = orientPathFromPin({ trace: firstTrace, pin: sharedPin })
  const second = orientPathFromPin({ trace: secondTrace, pin: sharedPin })
  if (!first || !second) return null
  const firstEnd = first.path[1]
  const secondEnd = second.path[1]
  if (!firstEnd || !secondEnd) return null

  const firstDirection = getUnitDirection({ start: sharedPin, end: firstEnd })
  const secondDirection = getUnitDirection({ start: sharedPin, end: secondEnd })
  if (!firstDirection || !secondDirection) return null
  if (
    firstDirection.x !== secondDirection.x ||
    firstDirection.y !== secondDirection.y
  ) {
    return null
  }

  const firstLength = getLength({ start: sharedPin, end: firstEnd })
  const secondLength = getLength({ start: sharedPin, end: secondEnd })
  const sharedLength = Math.min(firstLength, secondLength)
  if (nearlyEqual(sharedLength, 0)) return null
  if (
    sharedLength > MAX_SHARED_PIN_TAIL_LENGTH &&
    !nearlyEqual(sharedLength, MAX_SHARED_PIN_TAIL_LENGTH)
  ) {
    return null
  }

  let junction = firstEnd
  let branch = second
  let trunkPath = firstTrace.tracePath
  let trimFirstTrace = false
  if (firstLength > secondLength && !nearlyEqual(firstLength, secondLength)) {
    junction = secondEnd
    branch = first
    trunkPath = secondTrace.tracePath
    trimFirstTrace = true
  }
  let path = simplifyPath([junction, ...branch.path.slice(1)])
  if (branch.reverseOutput) path = [...path].reverse()
  return { path, trunkPath, trimFirstTrace }
}

const pointIsOnSegment = ({
  point,
  start,
  end,
}: {
  point: Point
  start: Point
  end: Point
}) => {
  if (isHorizontal(start, end) && nearlyEqual(point.y, start.y)) {
    return (
      point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
    )
  }
  if (!isVertical(start, end) || !nearlyEqual(point.x, start.x)) return false
  return (
    point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y)
  )
}

const getSegmentContainingPoint = ({
  path,
  point,
}: {
  path: Point[]
  point: Point
}) => {
  for (let index = 0; index < path.length - 1; index++) {
    const start = path[index]!
    const end = path[index + 1]!
    if (pointIsOnSegment({ point, start, end })) return { start, end }
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
  const trunkSegment = getSegmentContainingPoint({
    path: trunkPath,
    point: junction,
  })
  if (!trunkSegment) return null
  if (getLength({ start: outwardEnd, end: offsetEnd }) > MAX_HAIRPIN_OFFSET) {
    return null
  }

  let snappedOutwardEnd: Point
  let rejoinPointMatches: (point: Point) => boolean
  if (isHorizontal(trunkSegment.start, trunkSegment.end)) {
    if (
      !isHorizontal(junction, outwardEnd) ||
      !isVertical(outwardEnd, offsetEnd)
    ) {
      return null
    }
    snappedOutwardEnd = { x: outwardEnd.x, y: junction.y }
    rejoinPointMatches = (point) => nearlyEqual(point.x, snappedOutwardEnd.x)
  } else {
    if (
      !isVertical(junction, outwardEnd) ||
      !isHorizontal(outwardEnd, offsetEnd)
    ) {
      return null
    }
    snappedOutwardEnd = { x: junction.x, y: outwardEnd.y }
    rejoinPointMatches = (point) => nearlyEqual(point.y, snappedOutwardEnd.y)
  }

  for (let rejoinIndex = 4; rejoinIndex < branchPath.length; rejoinIndex++) {
    if (!rejoinPointMatches(branchPath[rejoinIndex]!)) continue
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
  alignedBranchTraceIds,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  alignedSectionIds: Set<SectionId>
  alignedBranchTraceIds: Set<string>
}) => {
  const outputTraces = traces.map((trace) => ({ ...trace }))
  let trimmedSameNetOverlapCount = 0
  let collapsedSameNetHairpinCount = 0
  if (
    alignedBranchTraceIds.size !== 1 ||
    inputProblem.directConnections.length > 0
  ) {
    return {
      traces: outputTraces,
      trimmedSameNetOverlapCount,
      collapsedSameNetHairpinCount,
    }
  }

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
      const sharedPin = getSharedPin({ firstTrace, secondTrace })
      if (!sharedPin) continue
      const sharedPinChip = inputProblem.chips.find(
        (chip) => chip.chipId === sharedPin.chipId,
      )
      if (
        !sharedPinChip?.sectionId ||
        !alignedSectionIds.has(sharedPinChip.sectionId)
      ) {
        continue
      }

      const trimmedTail = getTrimmedTail({
        firstTrace,
        secondTrace,
        sharedPin,
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
      let trimmedIndex = secondIndex
      if (trimmedTail.trimFirstTrace) trimmedIndex = firstIndex
      outputTraces[trimmedIndex] = {
        ...outputTraces[trimmedIndex]!,
        tracePath,
      }
      trimmedSameNetOverlapCount++
    }
  }

  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
    collapsedSameNetHairpinCount,
  }
}
