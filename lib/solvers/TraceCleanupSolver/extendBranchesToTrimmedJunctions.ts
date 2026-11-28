import {
  isAxisAlignedSegment,
  projectPointToPath,
} from "lib/solvers/Example28Solver/geometry"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { findShiftedRailBranchJunction } from "./findShiftedRailBranchJunction"
import { simplifyPath } from "./simplifyPath"

/** Extend branch ends along an existing host segment or shifted parallel rail. */
export const extendBranchesToTrimmedJunctions = ({
  originalTrace,
  updatedTrace,
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
}: {
  originalTrace: SolvedTracePath
  updatedTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
  allLabelPlacements?: NetLabelPlacement[]
  mergedLabelNetIdMap?: Record<string, Set<string>>
}): SolvedTracePath[] | null => {
  const simplifiedPath = simplifyPath(originalTrace.tracePath)
  const extendedTraces: SolvedTracePath[] = []
  for (const trace of traces) {
    if (
      trace.mspPairId === originalTrace.mspPairId ||
      trace.globalConnNetId !== originalTrace.globalConnNetId
    ) {
      extendedTraces.push(trace)
      continue
    }
    const tracePath = [...trace.tracePath]
    for (const endpointIndex of [0, tracePath.length - 1]) {
      const endpoint = tracePath[endpointIndex]
      if (!endpoint) continue
      if (
        !tracePathContainsPoint(originalTrace.tracePath, endpoint) ||
        tracePathContainsPoint(updatedTrace.tracePath, endpoint)
      ) {
        continue
      }
      let neighbor = tracePath[endpointIndex - 1]
      if (endpointIndex === 0) neighbor = tracePath[1]
      const isPinEndpoint = trace.pins.some(
        (pin) => pin.x === endpoint.x && pin.y === endpoint.y,
      )
      if (!neighbor || isPinEndpoint) {
        if (!tracePathContainsPoint(simplifiedPath, endpoint)) return null
        continue
      }

      if (!tracePathContainsPoint(simplifiedPath, endpoint)) {
        const junction = projectPointToPath(endpoint, updatedTrace.tracePath)
        const followsHostStroke =
          junction !== null &&
          isAxisAlignedSegment(neighbor, junction) &&
          originalTrace.tracePath.slice(1).some((end, index) => {
            const start = originalTrace.tracePath[index]
            if (!start) return false
            const segment = [start, end]
            return (
              tracePathContainsPoint(segment, endpoint) &&
              tracePathContainsPoint(segment, junction)
            )
          })
        if (!followsHostStroke || !junction) return null
        tracePath[endpointIndex] = junction
        continue
      }

      const shiftedJunction = findShiftedRailBranchJunction({
        neighbor,
        endpoint,
        branchTraceId: trace.mspPairId,
        originalTrace,
        updatedTrace,
        traces,
        inputProblem,
        allLabelPlacements,
        mergedLabelNetIdMap,
      })
      if (!shiftedJunction) return null
      tracePath[endpointIndex] = shiftedJunction
    }
    extendedTraces.push({ ...trace, tracePath })
  }
  return extendedTraces
}
