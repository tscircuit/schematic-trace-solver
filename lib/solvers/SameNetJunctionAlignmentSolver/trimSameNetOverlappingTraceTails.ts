import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { isPathCollidingWithObstacles } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem, SectionId } from "lib/types/InputProblem"

interface PathFromSharedPin {
  points: Point[]
  sharedPinIsPathStart: boolean
}

const MAX_SHARED_PIN_TAIL_LENGTH = 0.2
const MAX_PARALLEL_RETURN_OFFSET = 0.05

const getSharedPin = ({
  firstTrace,
  secondTrace,
}: {
  firstTrace: SolvedTracePath
  secondTrace: SolvedTracePath
}): (InputPin & { chipId: string }) | null => {
  const secondTracePinIds = new Set(secondTrace.pins.map((pin) => pin.pinId))
  return firstTrace.pins.find((pin) => secondTracePinIds.has(pin.pinId)) ?? null
}

const getPathFromSharedPin = ({
  trace,
  sharedPin,
}: {
  trace: SolvedTracePath
  sharedPin: Point
}): PathFromSharedPin | null => {
  if (pointsEqual(trace.tracePath[0]!, sharedPin)) {
    return { points: trace.tracePath, sharedPinIsPathStart: true }
  }
  if (pointsEqual(trace.tracePath[trace.tracePath.length - 1]!, sharedPin)) {
    return {
      points: [...trace.tracePath].reverse(),
      sharedPinIsPathStart: false,
    }
  }
  return null
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

const getCommonTailEnd = ({
  firstPath,
  secondPath,
}: {
  firstPath: Point[]
  secondPath: Point[]
}): Point | null => {
  let commonEnd = firstPath[0]!
  let firstSegmentIndex = 0
  let secondSegmentIndex = 0
  let commonLength = 0

  while (
    firstSegmentIndex < firstPath.length - 1 &&
    secondSegmentIndex < secondPath.length - 1
  ) {
    const firstSegmentEnd = firstPath[firstSegmentIndex + 1]!
    const secondSegmentEnd = secondPath[secondSegmentIndex + 1]!
    const firstDirection = getUnitDirection({
      start: commonEnd,
      end: firstSegmentEnd,
    })
    const secondDirection = getUnitDirection({
      start: commonEnd,
      end: secondSegmentEnd,
    })
    if (!firstDirection || !secondDirection) break
    if (
      firstDirection.x !== secondDirection.x ||
      firstDirection.y !== secondDirection.y
    ) {
      break
    }

    const firstSegmentLength = getSegmentLength({
      start: commonEnd,
      end: firstSegmentEnd,
    })
    const secondSegmentLength = getSegmentLength({
      start: commonEnd,
      end: secondSegmentEnd,
    })
    const sharedLength = Math.min(firstSegmentLength, secondSegmentLength)
    if (nearlyEqual(sharedLength, 0)) break

    if (
      firstSegmentLength < secondSegmentLength ||
      nearlyEqual(firstSegmentLength, secondSegmentLength)
    ) {
      commonEnd = firstSegmentEnd
    } else if (firstDirection.x !== 0) {
      commonEnd = { x: secondSegmentEnd.x, y: firstSegmentEnd.y }
    } else {
      commonEnd = { x: firstSegmentEnd.x, y: secondSegmentEnd.y }
    }
    commonLength += sharedLength

    if (nearlyEqual(sharedLength, firstSegmentLength)) {
      firstSegmentIndex++
    }
    if (nearlyEqual(sharedLength, secondSegmentLength)) {
      secondSegmentIndex++
    }
  }

  if (nearlyEqual(commonLength, 0)) return null
  return commonEnd
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
  if (nearlyEqual(start.x, end.x) && nearlyEqual(point.x, start.x)) {
    return (
      point.y >= Math.min(start.y, end.y) && point.y <= Math.max(start.y, end.y)
    )
  }
  if (nearlyEqual(start.y, end.y) && nearlyEqual(point.y, start.y)) {
    return (
      point.x >= Math.min(start.x, end.x) && point.x <= Math.max(start.x, end.x)
    )
  }
  return false
}

const getPathAfterCommonTail = ({
  pathFromSharedPin,
  commonTailEnd,
}: {
  pathFromSharedPin: PathFromSharedPin
  commonTailEnd: Point
}): Point[] | null => {
  const { points, sharedPinIsPathStart } = pathFromSharedPin
  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex++) {
    const start = points[segmentIndex]!
    const end = points[segmentIndex + 1]!
    if (!pointIsOnSegment({ point: commonTailEnd, start, end })) continue

    const remainingPath = simplifyPath([
      commonTailEnd,
      ...points.slice(segmentIndex + 1),
    ])
    if (remainingPath.length < 2) return null
    if (sharedPinIsPathStart) return remainingPath
    return [...remainingPath].reverse()
  }
  return null
}

const collapseNearParallelReturnToTrunk = ({
  branchPath,
  trunkPath,
  inputProblem,
}: {
  branchPath: Point[]
  trunkPath: Point[]
  inputProblem: InputProblem
}): { path: Point[]; collapsed: boolean } => {
  let pathFromTrunk = branchPath
  let pathWasReversed = false
  let trunkSegment: { start: Point; end: Point } | null = null

  for (let index = 0; index < trunkPath.length - 1; index++) {
    const start = trunkPath[index]!
    const end = trunkPath[index + 1]!
    if (pointIsOnSegment({ point: pathFromTrunk[0]!, start, end })) {
      trunkSegment = { start, end }
      break
    }
  }
  if (!trunkSegment) {
    pathFromTrunk = [...branchPath].reverse()
    pathWasReversed = true
    for (let index = 0; index < trunkPath.length - 1; index++) {
      const start = trunkPath[index]!
      const end = trunkPath[index + 1]!
      if (pointIsOnSegment({ point: pathFromTrunk[0]!, start, end })) {
        trunkSegment = { start, end }
        break
      }
    }
  }
  if (!trunkSegment || pathFromTrunk.length < 5) {
    return { path: branchPath, collapsed: false }
  }

  const junction = pathFromTrunk[0]!
  const outwardEnd = pathFromTrunk[1]!
  const offsetEnd = pathFromTrunk[2]!
  const returnEnd = pathFromTrunk[3]!
  const trunkDirection = getUnitDirection(trunkSegment)
  const outwardDirection = getUnitDirection({
    start: junction,
    end: outwardEnd,
  })
  const offsetDirection = getUnitDirection({
    start: outwardEnd,
    end: offsetEnd,
  })
  const returnDirection = getUnitDirection({
    start: offsetEnd,
    end: returnEnd,
  })
  if (
    !trunkDirection ||
    !outwardDirection ||
    !offsetDirection ||
    !returnDirection
  ) {
    return { path: branchPath, collapsed: false }
  }
  const outwardIsParallelToTrunk =
    Math.abs(
      outwardDirection.x * trunkDirection.x +
        outwardDirection.y * trunkDirection.y,
    ) === 1
  const returnReversesOutward =
    returnDirection.x === -outwardDirection.x &&
    returnDirection.y === -outwardDirection.y
  const offsetIsPerpendicular =
    offsetDirection.x * trunkDirection.x +
      offsetDirection.y * trunkDirection.y ===
    0
  const offsetLength = getSegmentLength({
    start: outwardEnd,
    end: offsetEnd,
  })
  if (
    !outwardIsParallelToTrunk ||
    !returnReversesOutward ||
    !offsetIsPerpendicular ||
    offsetLength > MAX_PARALLEL_RETURN_OFFSET
  ) {
    return { path: branchPath, collapsed: false }
  }

  for (let rejoinIndex = 4; rejoinIndex < pathFromTrunk.length; rejoinIndex++) {
    const rejoinPoint = pathFromTrunk[rejoinIndex]!
    let snappedOutwardEnd = { x: outwardEnd.x, y: junction.y }
    if (trunkDirection.y !== 0) {
      snappedOutwardEnd = { x: junction.x, y: outwardEnd.y }
    }
    const shortcutDirection = getUnitDirection({
      start: snappedOutwardEnd,
      end: rejoinPoint,
    })
    if (!shortcutDirection) continue
    const shortcutIsPerpendicular =
      shortcutDirection.x * trunkDirection.x +
        shortcutDirection.y * trunkDirection.y ===
      0
    if (!shortcutIsPerpendicular) continue

    const collapsedPath = simplifyPath([
      junction,
      snappedOutwardEnd,
      ...pathFromTrunk.slice(rejoinIndex),
    ])
    if (
      isPathCollidingWithObstacles(
        collapsedPath,
        getObstacleRects(inputProblem),
      )
    ) {
      continue
    }
    if (pathWasReversed) collapsedPath.reverse()
    return { path: collapsedPath, collapsed: true }
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
  // This cleanup is proven for a net-connection-only section with one newly
  // aligned branch. Preserve direct-connection and multi-alignment layouts.
  if (
    alignedBranchTraceIds.size !== 1 ||
    inputProblem.directConnections.length > 0
  ) {
    return { traces: outputTraces, trimmedSameNetOverlapCount: 0 }
  }
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
      const sharedPinChip = inputProblem.chips.find(
        (chip) => chip.chipId === sharedPin.chipId,
      )
      if (
        !sharedPinChip?.sectionId ||
        !alignedSectionIds.has(sharedPinChip.sectionId)
      ) {
        continue
      }
      const firstPathFromSharedPin = getPathFromSharedPin({
        trace: firstTrace,
        sharedPin,
      })
      const secondPathFromSharedPin = getPathFromSharedPin({
        trace: secondTrace,
        sharedPin,
      })
      if (!firstPathFromSharedPin || !secondPathFromSharedPin) continue

      const commonTailEnd = getCommonTailEnd({
        firstPath: firstPathFromSharedPin.points,
        secondPath: secondPathFromSharedPin.points,
      })
      if (!commonTailEnd) continue
      const commonTailLength = getSegmentLength({
        start: sharedPin,
        end: commonTailEnd,
      })
      if (
        commonTailLength > MAX_SHARED_PIN_TAIL_LENGTH &&
        !nearlyEqual(commonTailLength, MAX_SHARED_PIN_TAIL_LENGTH)
      ) {
        continue
      }

      const trimmedSecondPath = getPathAfterCommonTail({
        pathFromSharedPin: secondPathFromSharedPin,
        commonTailEnd,
      })
      if (trimmedSecondPath) {
        const collapsedPath = collapseNearParallelReturnToTrunk({
          branchPath: trimmedSecondPath,
          trunkPath: firstTrace.tracePath,
          inputProblem,
        })
        // Keep the first tail as the shared trunk and start the second path at
        // the point where its incoming branch diverges.
        outputTraces[secondIndex] = {
          ...secondTrace,
          tracePath: collapsedPath.path,
        }
        if (collapsedPath.collapsed) collapsedSameNetHairpinCount++
        trimmedSameNetOverlapCount++
        continue
      }

      const trimmedFirstPath = getPathAfterCommonTail({
        pathFromSharedPin: firstPathFromSharedPin,
        commonTailEnd,
      })
      if (!trimmedFirstPath) continue
      const collapsedPath = collapseNearParallelReturnToTrunk({
        branchPath: trimmedFirstPath,
        trunkPath: secondTrace.tracePath,
        inputProblem,
      })
      outputTraces[firstIndex] = {
        ...firstTrace,
        tracePath: collapsedPath.path,
      }
      if (collapsedPath.collapsed) collapsedSameNetHairpinCount++
      trimmedSameNetOverlapCount++
    }
  }

  return {
    traces: outputTraces,
    trimmedSameNetOverlapCount,
    collapsedSameNetHairpinCount,
  }
}
