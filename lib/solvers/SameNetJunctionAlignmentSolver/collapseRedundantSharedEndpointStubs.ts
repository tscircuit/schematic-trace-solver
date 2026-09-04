import type { Point } from "@tscircuit/math-utils"
import type { PinId } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  nearlyEqual,
  pointsEqual,
} from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { getSharedPin } from "./getSharedPin"

const getSegmentAxis = (start: Point, end: Point) => {
  if (nearlyEqual(start.x, end.x)) return "y" as const
  if (nearlyEqual(start.y, end.y)) return "x" as const
  return null
}

const getPathFromSharedPin = ({
  trace,
  sharedPinId,
}: {
  trace: SolvedTracePath
  sharedPinId: PinId
}) => {
  const tracePath = simplifyPath(trace.tracePath)
  if (trace.pins[0]?.pinId === sharedPinId) return tracePath
  return tracePath.reverse()
}

const traceCanLoseSharedPrefix = ({
  trace,
  sharedPrefix,
  netLabelPlacements,
}: {
  trace: SolvedTracePath
  sharedPrefix: Point[]
  netLabelPlacements: NetLabelPlacement[]
}) => {
  return !netLabelPlacements.some(
    (label) =>
      label.mspConnectionPairIds.includes(trace.mspPairId) &&
      tracePathContainsPoint(sharedPrefix, label.anchorPoint),
  )
}

const getTraceWithoutSharedPrefix = ({
  trace,
  pathFromSharedPin,
  sharedPinId,
  branchPoint,
}: {
  trace: SolvedTracePath
  pathFromSharedPin: Point[]
  sharedPinId: PinId
  branchPoint: Point
}) => {
  const branchSegmentIndex = pathFromSharedPin.findIndex((point, index) => {
    const nextPoint = pathFromSharedPin[index + 1]
    if (!nextPoint) return false
    return tracePathContainsPoint([point, nextPoint], branchPoint)
  })
  if (branchSegmentIndex < 0) return null
  const pathFromJunction = simplifyPath([
    branchPoint,
    ...pathFromSharedPin.slice(branchSegmentIndex + 1),
  ])
  let tracePath = pathFromJunction
  if (trace.pins[0]?.pinId !== sharedPinId) {
    tracePath = pathFromJunction.reverse()
  }
  return { ...trace, tracePath }
}

export const collapseRedundantSharedEndpointStubs = ({
  traces,
  netLabelPlacements,
  netLabelConnectorTraceIds,
  multiPinNetPinIds,
}: {
  traces: SolvedTracePath[]
  netLabelPlacements: NetLabelPlacement[]
  netLabelConnectorTraceIds: ReadonlySet<MspConnectionPairId>
  multiPinNetPinIds: ReadonlySet<PinId>
}) => {
  const outputTraces = [...traces]

  for (let firstIndex = 0; firstIndex < outputTraces.length; firstIndex++) {
    const firstTrace = outputTraces[firstIndex]!
    if (netLabelConnectorTraceIds.has(firstTrace.mspPairId)) continue
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < outputTraces.length;
      secondIndex++
    ) {
      const secondTrace = outputTraces[secondIndex]!
      if (
        netLabelConnectorTraceIds.has(secondTrace.mspPairId) ||
        firstTrace.globalConnNetId !== secondTrace.globalConnNetId
      ) {
        continue
      }
      const sharedPin = getSharedPin({
        donorTrace: firstTrace,
        branchTrace: secondTrace,
      })
      if (!sharedPin || !multiPinNetPinIds.has(sharedPin.pinId)) continue
      const firstPath = getPathFromSharedPin({
        trace: firstTrace,
        sharedPinId: sharedPin.pinId,
      })
      const secondPath = getPathFromSharedPin({
        trace: secondTrace,
        sharedPinId: sharedPin.pinId,
      })
      if (firstPath.length < 2 || secondPath.length < 2) continue

      const departureAxis = getSegmentAxis(firstPath[0]!, firstPath[1]!)
      const secondDepartureAxis = getSegmentAxis(secondPath[0]!, secondPath[1]!)
      if (!departureAxis || departureAxis !== secondDepartureAxis) continue

      const firstDepartureDirection =
        firstPath[1]![departureAxis] - firstPath[0]![departureAxis]
      const secondDepartureDirection =
        secondPath[1]![departureAxis] - secondPath[0]![departureAxis]
      if (
        !pointsEqual(firstPath[1]!, secondPath[1]!) &&
        Math.sign(firstDepartureDirection) ===
          Math.sign(secondDepartureDirection)
      ) {
        let traceIndexToCollapse = secondIndex
        let traceToCollapse = secondTrace
        let pathToCollapse = secondPath
        if (
          Math.abs(firstDepartureDirection) < Math.abs(secondDepartureDirection)
        ) {
          traceIndexToCollapse = firstIndex
          traceToCollapse = firstTrace
          pathToCollapse = firstPath
        }
        const branchPoint = pathToCollapse[1]!
        if (
          !traceCanLoseSharedPrefix({
            trace: traceToCollapse,
            sharedPrefix: [pathToCollapse[0]!, branchPoint],
            netLabelPlacements,
          })
        ) {
          if (traceIndexToCollapse === firstIndex) {
            traceIndexToCollapse = secondIndex
            traceToCollapse = secondTrace
            pathToCollapse = secondPath
          } else {
            traceIndexToCollapse = firstIndex
            traceToCollapse = firstTrace
            pathToCollapse = firstPath
          }
        }
        if (
          !traceCanLoseSharedPrefix({
            trace: traceToCollapse,
            sharedPrefix: [pathToCollapse[0]!, branchPoint],
            netLabelPlacements,
          })
        ) {
          continue
        }
        const collapsedTrace = getTraceWithoutSharedPrefix({
          trace: traceToCollapse,
          pathFromSharedPin: pathToCollapse,
          sharedPinId: sharedPin.pinId,
          branchPoint,
        })
        if (!collapsedTrace) continue
        outputTraces[traceIndexToCollapse] = collapsedTrace
        break
      }
      if (firstPath.length < 3 || secondPath.length < 3) continue
      if (!pointsEqual(firstPath[1]!, secondPath[1]!)) continue

      const railAxis = getSegmentAxis(firstPath[1]!, firstPath[2]!)
      const secondRailAxis = getSegmentAxis(secondPath[1]!, secondPath[2]!)
      if (
        !railAxis ||
        railAxis !== secondRailAxis ||
        railAxis === departureAxis
      ) {
        continue
      }
      const firstRailDirection =
        firstPath[2]![railAxis] - firstPath[1]![railAxis]
      const secondRailDirection =
        secondPath[2]![railAxis] - secondPath[1]![railAxis]
      const railsHaveSameDirection =
        Math.sign(firstRailDirection) === Math.sign(secondRailDirection)
      const sharedStub = firstPath.slice(0, 2)
      if (
        !railsHaveSameDirection &&
        !nearlyEqual(
          Math.abs(firstRailDirection),
          Math.abs(secondRailDirection),
        ) &&
        netLabelPlacements.some(
          (label) =>
            label.globalConnNetId === firstTrace.globalConnNetId &&
            tracePathContainsPoint(sharedStub, label.anchorPoint),
        )
      ) {
        continue
      }
      let traceIndexToCollapse = secondIndex
      let traceToCollapse = secondTrace
      let pathToCollapse = secondPath
      let branchPoint = firstPath[1]!
      if (
        railsHaveSameDirection &&
        Math.abs(firstRailDirection) < Math.abs(secondRailDirection)
      ) {
        traceIndexToCollapse = firstIndex
        traceToCollapse = firstTrace
        pathToCollapse = firstPath
        branchPoint = firstPath[2]!
      } else if (railsHaveSameDirection) {
        branchPoint = secondPath[2]!
      }
      const sharedPrefix = [pathToCollapse[0]!, pathToCollapse[1]!, branchPoint]
      if (
        !traceCanLoseSharedPrefix({
          trace: traceToCollapse,
          sharedPrefix,
          netLabelPlacements,
        })
      ) {
        if (traceIndexToCollapse === firstIndex) {
          traceIndexToCollapse = secondIndex
          traceToCollapse = secondTrace
          pathToCollapse = secondPath
        } else {
          traceIndexToCollapse = firstIndex
          traceToCollapse = firstTrace
          pathToCollapse = firstPath
        }
      }
      if (
        !traceCanLoseSharedPrefix({
          trace: traceToCollapse,
          sharedPrefix: [pathToCollapse[0]!, pathToCollapse[1]!, branchPoint],
          netLabelPlacements,
        })
      ) {
        continue
      }
      const collapsedTrace = getTraceWithoutSharedPrefix({
        trace: traceToCollapse,
        pathFromSharedPin: pathToCollapse,
        sharedPinId: sharedPin.pinId,
        branchPoint,
      })
      if (!collapsedTrace) continue
      outputTraces[traceIndexToCollapse] = collapsedTrace
      break
    }
  }

  return outputTraces
}
