import {
  countPathIntersections,
  getDistance,
  getSegmentOrientation,
  isAxisAlignedSegment,
  isPathCollidingWithChipInterior,
  projectPointToPath,
} from "lib/solvers/Example28Solver/geometry"
import { EPS } from "lib/solvers/Example28Solver/types"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import type { InputProblem } from "lib/types/InputProblem"
import { simplifyPath } from "./simplifyPath"

/** Extend branch ends along an existing host segment or branch terminal axis when the host trace is cleaned up. */
export const extendBranchesToTrimmedJunctions = ({
  originalTrace,
  updatedTrace,
  traces,
  inputProblem,
}: {
  originalTrace: SolvedTracePath
  updatedTrace: SolvedTracePath
  traces: SolvedTracePath[]
  inputProblem?: InputProblem
}): SolvedTracePath[] | null => {
  const simplifiedPath = simplifyPath(originalTrace.tracePath)
  const chipObstacles = inputProblem ? getObstacleRects(inputProblem) : []
  const differentNetTraces = traces.filter(
    (trace) => trace.globalConnNetId !== originalTrace.globalConnNetId,
  )
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
        tracePathContainsPoint(updatedTrace.tracePath, endpoint)
      ) {
        continue
      }
      const junction = projectPointToPath(endpoint, updatedTrace.tracePath)
      let neighbor = tracePath[endpointIndex - 1]
      if (endpointIndex === 0) neighbor = tracePath[1]
      const followsTrimmedHostSegment =
        !tracePathContainsPoint(simplifiedPath, endpoint) &&
        originalTrace.tracePath.slice(1).some((end, index) => {
          const segment = [originalTrace.tracePath[index]!, end]
          return (
            tracePathContainsPoint(segment, endpoint) &&
            Boolean(junction && tracePathContainsPoint(segment, junction))
          )
        })
      const isRetractingAlongBranch = Boolean(
        junction &&
          neighbor &&
          tracePathContainsPoint([neighbor, endpoint], junction),
      )
      const extensionSegment = junction ? [endpoint, junction] : []
      const extensionCollides =
        Boolean(junction) &&
        !isRetractingAlongBranch &&
        (isPathCollidingWithChipInterior(extensionSegment, chipObstacles) ||
          differentNetTraces.some(
            (otherTrace) =>
              countPathIntersections(extensionSegment, otherTrace.tracePath) >
              0,
          ))
      const followsBranchTerminalAxis = Boolean(
        junction &&
          neighbor &&
          !extensionCollides &&
          isAxisAlignedSegment(neighbor, endpoint) &&
          isAxisAlignedSegment(endpoint, junction) &&
          isAxisAlignedSegment(neighbor, junction) &&
          getDistance(neighbor, junction) > EPS &&
          getSegmentOrientation(neighbor, endpoint) ===
            getSegmentOrientation(neighbor, junction) &&
          Math.sign(junction.x - neighbor.x) ===
            Math.sign(endpoint.x - neighbor.x) &&
          Math.sign(junction.y - neighbor.y) ===
            Math.sign(endpoint.y - neighbor.y),
      )
      // The extension must follow an existing host stroke or branch terminal axis, without moving a pin.
      if (
        !junction ||
        !neighbor ||
        !isAxisAlignedSegment(neighbor, junction) ||
        trace.pins.some(
          (pin) => pin.x === endpoint.x && pin.y === endpoint.y,
        ) ||
        (!followsTrimmedHostSegment && !followsBranchTerminalAxis)
      ) {
        return null
      }
      tracePath[endpointIndex] = junction
    }
    extendedTraces.push({ ...trace, tracePath })
  }
  return extendedTraces
}
