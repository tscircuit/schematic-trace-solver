import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type {
  InputDirectConnection,
  InputNetConnection,
  PinId,
} from "lib/types/InputProblem"
import { getAxisAlignedSegments } from "./getAxisAlignedSegments"

type InlineEligibleConnection = InputDirectConnection | InputNetConnection

const getLongestStraightRunLength = (trace: SolvedTracePath): number =>
  getAxisAlignedSegments(trace.tracePath)[0]?.length ?? 0

/**
 * Orders replacement branches by available straight-line label space.
 */
export const getRoutedEndpointTracesForReplacedMspPair = ({
  connection,
  traces,
}: {
  connection: InlineEligibleConnection
  traces: SolvedTracePath[]
}): SolvedTracePath[] => {
  if (connection.pinIds.length !== 2) return []

  const connectionPinIds = new Set<PinId>(connection.pinIds)
  return traces
    .filter((trace) =>
      trace.pins.some((pin) => connectionPinIds.has(pin.pinId)),
    )
    .sort(
      (firstTrace, secondTrace) =>
        getLongestStraightRunLength(secondTrace) -
        getLongestStraightRunLength(firstTrace),
    )
}
