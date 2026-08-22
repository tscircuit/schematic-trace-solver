import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

const MIN_EXCESSIVE_DETOUR_LENGTH_RATIO = 2.5

const getTracePathLength = (
  tracePath: SolvedTracePath["tracePath"],
): number => {
  let pathLength = 0
  for (let pointIndex = 1; pointIndex < tracePath.length; pointIndex++) {
    const previousPoint = tracePath[pointIndex - 1]!
    const point = tracePath[pointIndex]!
    pathLength +=
      Math.abs(point.x - previousPoint.x) + Math.abs(point.y - previousPoint.y)
  }
  return pathLength
}

/**
 * Retries an already-solved severe detour with its exact direct connection
 * first, preventing a sibling branch's label width from inflating text padding.
 * The shorter route is used only when it is less than 40% of the original.
 */
export const shortenExcessiveLabelPaddingDetour = ({
  inputProblem,
  trace,
}: {
  inputProblem: InputProblem
  trace: SolvedTracePath
}): SolvedTracePath => {
  const exactConnection = inputProblem.directConnections.find((connection) =>
    connection.pinIds.every((pinId) => trace.pinIds.includes(pinId)),
  )
  if (!exactConnection) return trace

  const chipMap: Record<string, InputChip> = {}
  for (const chip of inputProblem.chips) chipMap[chip.chipId] = chip

  const candidateSolver = new SchematicTraceSingleLineSolver2({
    pins: trace.pins,
    connectionPair: trace,
    inputProblem: {
      ...inputProblem,
      directConnections: [
        exactConnection,
        ...inputProblem.directConnections.filter(
          (connection) => connection !== exactConnection,
        ),
      ],
    },
    chipMap,
  })
  candidateSolver.solve()
  if (!candidateSolver.solvedTracePath) return trace

  const currentLength = getTracePathLength(trace.tracePath)
  const candidateLength = getTracePathLength(candidateSolver.solvedTracePath)
  if (currentLength <= candidateLength * MIN_EXCESSIVE_DETOUR_LENGTH_RATIO) {
    return trace
  }

  return { ...trace, tracePath: candidateSolver.solvedTracePath }
}
