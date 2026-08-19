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
import type {
  ChipId,
  InputPin,
  InputProblem,
  SectionId,
} from "lib/types/InputProblem"

interface OrientedPath {
  points: Point[]
  shouldReverseOutput: boolean
}

interface TrimmedTail {
  path: Point[]
  trunkPath: Point[]
  trimFirstTrace: boolean
}

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2
const MAX_PARALLEL_RETURN_OFFSET = 0.05
const MIN_HAIRPIN_POINT_COUNT = 6

const getSharedPin = ({
  firstTrace,
  secondTrace,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
}): (InputPin & { chipId: ChipId }) | null => {
  const secondTracePinIds = new Set(secondTrace.pins.map((pin) => pin.pinId))
  return firstTrace.pins.find((pin) => secondTracePinIds.has(pin.pinId)) ?? null
}

const orientPathFromPoint = ({
  path,
  point,
}: {
  path: Point[]
  point: Point
}): OrientedPath | null => {
  if (pointsEqual(path[0]!, point)) {
    return { points: path, shouldReverseOutput: false }
  }
  if (!pointsEqual(path.at(-1)!, point)) return null
  return { points: [...path].reverse(), shouldReverseOutput: true }
}

const getUnitDirection = ({ start, end }: { start: Point; end: Point }) => {
  if (nearlyEqual(start.x, end.x) && !nearlyEqual(start.y, end.y)) {
    return { x: 0, y: Math.sign(end.y - start.y) }
  }
  if (nearlyEqual(start.y, end.y) && !nearlyEqual(start.x, end.x)) {
    return { x: Math.sign(end.x - start.x), y: 0 }
  }
  return null
}

const getSegmentLength = ({ start, end }: { start: Point; end: Point }) =>
  Math.abs(end.x - start.x) + Math.abs(end.y - start.y)

const pointIsOnSegment = ({
  point,
  start,
  end,
}: {
  point: Point
  start: Point
  end: Point
}) => {
  if (nearlyEqual(start.x, end.x) && nearlyEqual(point.x, start.x)) {
    return (
      point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y)
    )
  }
  if (!nearlyEqual(start.y, end.y) || !nearlyEqual(point.y, start.y)) {
    return false
  }
  return (
    point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
  )
}

const reversePathIfNeeded = ({
  path,
  shouldReverse,
}: {
  path: Point[]
  shouldReverse: boolean
}) => {
  if (!shouldReverse) return path
  return [...path].reverse()
}

const getTrimmedSharedTail = ({
  firstTrace,
  secondTrace,
  sharedPin,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
  sharedPin: Point
}): TrimmedTail | null => {
  const firstPath = orientPathFromPoint({
    path: firstTrace.tracePath,
    point: sharedPin,
  })
  const secondPath = orientPathFromPoint({
    path: secondTrace.tracePath,
    point: sharedPin,
  })
  if (!firstPath || !secondPath) return null

  const firstEnd = firstPath.points[1]
  const secondEnd = secondPath.points[1]
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

  const firstLength = getSegmentLength({ start: sharedPin, end: firstEnd })
  const secondLength = getSegmentLength({ start: sharedPin, end: secondEnd })
  const sharedLength = Math.min(firstLength, secondLength)
  if (nearlyEqual(sharedLength, 0)) return null
  if (
    sharedLength > MAX_SHARED_PIN_TAIL_LENGTH &&
    !nearlyEqual(sharedLength, MAX_SHARED_PIN_TAIL_LENGTH)
  ) {
    return null
  }

  let junction = firstEnd
  let branchPath = secondPath
  let trunkPath = firstTrace.tracePath
  let trimFirstTrace = false
  if (firstLength > secondLength && !nearlyEqual(firstLength, secondLength)) {
    junction = secondEnd
    branchPath = firstPath
    trunkPath = secondTrace.tracePath
    trimFirstTrace = true
  }
  const path = simplifyPath([junction, ...branchPath.points.slice(1)])
  return {
    path: reversePathIfNeeded({
      path,
      shouldReverse: branchPath.shouldReverseOutput,
    }),
    trunkPath,
    trimFirstTrace,
  }
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

const getDirectionDotProduct = ({
  first,
  second,
}: {
  first: Point
  second: Point
}) => first.x * second.x + first.y * second.y

const collapseNearParallelReturn = ({
  branchPath,
  trunkPath,
  obstacles,
}: {
  branchPath: Point[]
  trunkPath: Point[]
  obstacles: ObstacleRect[]
}): { path: Point[]; collapsed: boolean } => {
  let pathFromTrunk = branchPath
  let shouldReverseOutput = false
  let trunkSegment = getSegmentContainingPoint({
    path: trunkPath,
    point: pathFromTrunk[0]!,
  })
  if (!trunkSegment) {
    pathFromTrunk = [...branchPath].reverse()
    shouldReverseOutput = true
    trunkSegment = getSegmentContainingPoint({
      path: trunkPath,
      point: pathFromTrunk[0]!,
    })
  }
  if (!trunkSegment || pathFromTrunk.length < MIN_HAIRPIN_POINT_COUNT) {
    return { path: branchPath, collapsed: false }
  }

  const junction = pathFromTrunk[0]!
  const outwardEnd = pathFromTrunk[1]!
  const offsetEnd = pathFromTrunk[2]!
  const trunkDirection = getUnitDirection(trunkSegment)
  const outwardDirection = getUnitDirection({
    start: junction,
    end: outwardEnd,
  })
  const offsetDirection = getUnitDirection({
    start: outwardEnd,
    end: offsetEnd,
  })
  if (!trunkDirection || !outwardDirection || !offsetDirection) {
    return { path: branchPath, collapsed: false }
  }
  const offsetLength = getSegmentLength({
    start: outwardEnd,
    end: offsetEnd,
  })
  if (
    Math.abs(
      getDirectionDotProduct({
        first: outwardDirection,
        second: trunkDirection,
      }),
    ) !== 1 ||
    getDirectionDotProduct({
      first: offsetDirection,
      second: trunkDirection,
    }) !== 0 ||
    offsetLength > MAX_PARALLEL_RETURN_OFFSET
  ) {
    return { path: branchPath, collapsed: false }
  }

  let snappedOutwardEnd = { x: outwardEnd.x, y: junction.y }
  if (trunkDirection.y !== 0) {
    snappedOutwardEnd = { x: junction.x, y: outwardEnd.y }
  }
  for (let rejoinIndex = 4; rejoinIndex < pathFromTrunk.length; rejoinIndex++) {
    const rejoinPoint = pathFromTrunk[rejoinIndex]!
    const shortcutDirection = getUnitDirection({
      start: snappedOutwardEnd,
      end: rejoinPoint,
    })
    if (!shortcutDirection) continue
    if (
      getDirectionDotProduct({
        first: shortcutDirection,
        second: trunkDirection,
      }) !== 0
    )
      continue
    const collapsedPath = simplifyPath([
      junction,
      snappedOutwardEnd,
      ...pathFromTrunk.slice(rejoinIndex),
    ])
    if (isPathCollidingWithObstacles(collapsedPath, obstacles)) continue
    return {
      path: reversePathIfNeeded({
        path: collapsedPath,
        shouldReverse: shouldReverseOutput,
      }),
      collapsed: true,
    }
  }
  return { path: branchPath, collapsed: false }
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
  const emptyResult = {
    traces: outputTraces,
    trimmedSameNetOverlapCount: 0,
    collapsedSameNetHairpinCount: 0,
  }
  // This cleanup is proven for a net-connection-only section with one newly
  // aligned branch. Preserve direct-connection and multi-alignment layouts.
  if (
    alignedBranchTraceIds.size !== 1 ||
    inputProblem.directConnections.length > 0
  ) {
    return emptyResult
  }

  const sectionIdByChipId = new Map<ChipId, SectionId | undefined>(
    inputProblem.chips.map((chip) => [chip.chipId, chip.sectionId]),
  )
  const obstacles = getObstacleRects(inputProblem)
  let trimmedSameNetOverlapCount = 0
  let collapsedSameNetHairpinCount = 0

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
      const sectionId = sectionIdByChipId.get(sharedPin.chipId)
      if (!sectionId || !alignedSectionIds.has(sectionId)) continue

      const trimmedTail = getTrimmedSharedTail({
        firstTrace,
        secondTrace,
        sharedPin,
      })
      if (!trimmedTail) continue
      const collapsedTail = collapseNearParallelReturn({
        branchPath: trimmedTail.path,
        trunkPath: trimmedTail.trunkPath,
        obstacles,
      })
      let trimmedIndex = secondIndex
      if (trimmedTail.trimFirstTrace) trimmedIndex = firstIndex
      outputTraces[trimmedIndex] = {
        ...outputTraces[trimmedIndex]!,
        tracePath: collapsedTail.path,
      }
      trimmedSameNetOverlapCount++
      if (collapsedTail.collapsed) collapsedSameNetHairpinCount++
    }
  }

  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
    collapsedSameNetHairpinCount,
  }
}
