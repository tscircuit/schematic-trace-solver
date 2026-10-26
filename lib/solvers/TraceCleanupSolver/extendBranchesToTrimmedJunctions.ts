import {
  isAxisAlignedSegment,
  projectPointToPath,
} from "lib/solvers/Example28Solver/geometry"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { simplifyPath } from "./simplifyPath"

/** Extend branch ends along an existing host segment when its backtracking is trimmed. */
export const extendBranchesToTrimmedJunctions = ({
  originalTrace,
  updatedTrace,
  traces,
}: {
  originalTrace: SolvedTracePath
  updatedTrace: SolvedTracePath
  traces: SolvedTracePath[]
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
      const endpoint = tracePath[endpointIndex]!
      if (
        !tracePathContainsPoint(originalTrace.tracePath, endpoint) ||
        tracePathContainsPoint(simplifiedPath, endpoint) ||
        tracePathContainsPoint(updatedTrace.tracePath, endpoint)
      ) {
        continue
      }
      const junction = projectPointToPath(endpoint, updatedTrace.tracePath)
      let neighbor = tracePath[endpointIndex - 1]
      if (endpointIndex === 0) neighbor = tracePath[1]
      // The extension must follow an existing host stroke, without moving a pin.
      if (
        !junction ||
        !neighbor ||
        !isAxisAlignedSegment(neighbor, junction) ||
        trace.pins.some(
          (pin) => pin.x === endpoint.x && pin.y === endpoint.y,
        ) ||
        !originalTrace.tracePath.slice(1).some((end, index) => {
          const segment = [originalTrace.tracePath[index]!, end]
          return (
            tracePathContainsPoint(segment, endpoint) &&
            tracePathContainsPoint(segment, junction)
          )
        })
      ) {
        return null
      }
      tracePath[endpointIndex] = junction
    }
    extendedTraces.push({ ...trace, tracePath })
  }
  return extendedTraces
}
