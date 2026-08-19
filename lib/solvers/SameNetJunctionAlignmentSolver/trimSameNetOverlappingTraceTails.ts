import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
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
        // Keep the first tail as the shared trunk and start the second path at
        // the point where its incoming branch diverges.
        outputTraces[secondIndex] = {
          ...secondTrace,
          tracePath: trimmedSecondPath,
        }
        trimmedSameNetOverlapCount++
        continue
      }

      const trimmedFirstPath = getPathAfterCommonTail({
        pathFromSharedPin: firstPathFromSharedPin,
        commonTailEnd,
      })
      if (!trimmedFirstPath) continue
      outputTraces[firstIndex] = {
        ...firstTrace,
        tracePath: trimmedFirstPath,
      }
      trimmedSameNetOverlapCount++
    }
  }

  return { traces: outputTraces, trimmedSameNetOverlapCount }
}
