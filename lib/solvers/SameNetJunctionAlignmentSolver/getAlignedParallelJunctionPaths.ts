import type { Point } from "@tscircuit/math-utils"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import {
  isHorizontal,
  isVertical,
  nearlyEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin } from "lib/types/InputProblem"

// Only near-level load pins should be combined onto one horizontal rail.
export const MAX_ALIGNED_LOAD_PIN_OFFSET = 0.2

export const getSharedPin = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): (InputPin & { chipId: string }) | null => {
  const branchPinIds = new Set(branchTrace.pins.map((pin) => pin.pinId))
  return donorTrace.pins.find((pin) => branchPinIds.has(pin.pinId)) ?? null
}

export const getOtherPin = ({
  trace,
  sharedPin,
}: {
  trace: SolvedTracePath
  sharedPin: InputPin
}) => trace.pins.find((pin) => pin.pinId !== sharedPin.pinId) ?? null

export const railIsOnFacingSide = ({
  railY,
  pin,
}: {
  railY: number
  pin: InputPin
}) => {
  if (pin._facingDirection === "y+") return railY > pin.y
  if (pin._facingDirection === "y-") return railY < pin.y
  return false
}

const isOrthogonalPath = (path: Point[]) => {
  for (let index = 1; index < path.length; index++) {
    if (
      !isHorizontal(path[index - 1]!, path[index]!) &&
      !isVertical(path[index - 1]!, path[index]!)
    ) {
      return false
    }
  }
  return true
}

export const getAlignedParallelPinExitPath = ({
  donorTrace,
  branchTrace,
}: {
  donorTrace: SolvedTracePath
  branchTrace: SolvedTracePath
}): Point[] | null => {
  const sharedPin = getSharedPin({ donorTrace, branchTrace })
  if (!sharedPin) return null
  const adjacentPin = getOtherPin({ trace: donorTrace, sharedPin })
  const targetPin = getOtherPin({ trace: branchTrace, sharedPin })
  if (!adjacentPin || !targetPin) return null

  const facingDirection = sharedPin._facingDirection
  if (facingDirection !== "x+" && facingDirection !== "x-") return null
  if (adjacentPin._facingDirection !== facingDirection) return null
  if (!nearlyEqual(sharedPin.x, adjacentPin.x)) return null
  const pinOffset = Math.abs(sharedPin.y - adjacentPin.y)
  if (
    pinOffset > MAX_ALIGNED_LOAD_PIN_OFFSET &&
    !nearlyEqual(pinOffset, MAX_ALIGNED_LOAD_PIN_OFFSET)
  ) {
    return null
  }

  let sharedToAdjacentPath = simplifyPath(donorTrace.tracePath)
  if (donorTrace.pins[0].pinId !== sharedPin.pinId) {
    sharedToAdjacentPath = sharedToAdjacentPath.reverse()
  }
  if (
    sharedToAdjacentPath.length < 3 ||
    !isOrthogonalPath(sharedToAdjacentPath) ||
    !isHorizontal(sharedToAdjacentPath[0]!, sharedToAdjacentPath[1]!) ||
    !isVertical(sharedToAdjacentPath[1]!, sharedToAdjacentPath[2]!)
  ) {
    return null
  }
  const junctionX = sharedToAdjacentPath[1]!.x
  if (facingDirection === "x+" && junctionX <= sharedPin.x) return null
  if (facingDirection === "x-" && junctionX >= sharedPin.x) return null
  const alignedRailJunction = { x: junctionX, y: adjacentPin.y }
  if (!tracePathContainsPoint(sharedToAdjacentPath, alignedRailJunction)) {
    return null
  }

  const branchStartsAtSharedPin = branchTrace.pins[0].pinId === sharedPin.pinId
  let sharedToTargetPath = simplifyPath(branchTrace.tracePath)
  if (!branchStartsAtSharedPin) {
    sharedToTargetPath = sharedToTargetPath.reverse()
  }
  if (
    sharedToTargetPath.length < 3 ||
    !isOrthogonalPath(sharedToTargetPath) ||
    !isHorizontal(sharedToTargetPath[0]!, sharedToTargetPath[1]!) ||
    !isVertical(sharedToTargetPath[1]!, sharedToTargetPath[2]!) ||
    !isVertical(sharedToTargetPath.at(-2)!, sharedToTargetPath.at(-1)!) ||
    !nearlyEqual(sharedToTargetPath[1]!.x, junctionX) ||
    !railIsOnFacingSide({ railY: adjacentPin.y, pin: targetPin }) ||
    nearlyEqual(sharedToTargetPath.at(-2)!.y, adjacentPin.y)
  ) {
    return null
  }

  const candidate = simplifyPath([
    { x: sharedPin.x, y: sharedPin.y },
    { x: junctionX, y: sharedPin.y },
    { x: junctionX, y: adjacentPin.y },
    { x: targetPin.x, y: adjacentPin.y },
    { x: targetPin.x, y: targetPin.y },
  ])
  if (branchStartsAtSharedPin) return candidate
  return candidate.reverse()
}

export const getAlignedReturnStemsPath = ({
  branchTrace,
  traces,
}: {
  branchTrace: SolvedTracePath
  traces: SolvedTracePath[]
}): Point[] | null => {
  const endpointFacingDirection = branchTrace.pins[0]._facingDirection
  if (endpointFacingDirection !== "y+" && endpointFacingDirection !== "y-") {
    return null
  }
  if (branchTrace.pins[1]._facingDirection !== endpointFacingDirection) {
    return null
  }
  if (!nearlyEqual(branchTrace.pins[0].x, branchTrace.pins[1].x)) return null

  let alignedPath = simplifyPath(branchTrace.tracePath)
  let changedStemCount = 0

  for (const sharedPin of branchTrace.pins) {
    const donorRailYs: number[] = []
    for (const donorTrace of traces) {
      if (
        donorTrace.mspPairId === branchTrace.mspPairId ||
        donorTrace.globalConnNetId !== branchTrace.globalConnNetId ||
        !donorTrace.pins.some((pin) => pin.pinId === sharedPin.pinId)
      ) {
        continue
      }

      let donorPath = simplifyPath(donorTrace.tracePath)
      if (donorTrace.pins[0].pinId !== sharedPin.pinId) {
        donorPath = donorPath.reverse()
      }
      if (
        donorPath.length >= 3 &&
        isVertical(donorPath[0]!, donorPath[1]!) &&
        isHorizontal(donorPath[1]!, donorPath[2]!) &&
        railIsOnFacingSide({ railY: donorPath[1]!.y, pin: sharedPin })
      ) {
        donorRailYs.push(donorPath[1]!.y)
      }
    }
    donorRailYs.sort(
      (firstRailY, secondRailY) =>
        Math.abs(firstRailY - sharedPin.y) -
        Math.abs(secondRailY - sharedPin.y),
    )
    const donorRailY = donorRailYs[0]
    if (donorRailY === undefined) return null

    const branchStartsAtSharedPin =
      branchTrace.pins[0].pinId === sharedPin.pinId
    let sharedToOtherPath = alignedPath
    if (!branchStartsAtSharedPin) {
      sharedToOtherPath = [...alignedPath].reverse()
    }
    if (
      sharedToOtherPath.length < 4 ||
      !isVertical(sharedToOtherPath[0]!, sharedToOtherPath[1]!) ||
      !isHorizontal(sharedToOtherPath[1]!, sharedToOtherPath[2]!) ||
      !railIsOnFacingSide({
        railY: sharedToOtherPath[1]!.y,
        pin: sharedPin,
      })
    ) {
      continue
    }
    if (nearlyEqual(sharedToOtherPath[1]!.y, donorRailY)) continue

    sharedToOtherPath = simplifyPath([
      sharedToOtherPath[0]!,
      { ...sharedToOtherPath[1]!, y: donorRailY },
      { ...sharedToOtherPath[2]!, y: donorRailY },
      ...sharedToOtherPath.slice(3),
    ])
    alignedPath = sharedToOtherPath
    if (!branchStartsAtSharedPin) {
      alignedPath = sharedToOtherPath.reverse()
    }
    changedStemCount++
  }

  if (changedStemCount === 0) return null
  return alignedPath
}
