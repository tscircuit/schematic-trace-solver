import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "../../../NetLabelPlacementSolver/NetLabelPlacementSolver"
import { minimizeTurns } from "./turnMinimization"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"

export const minimizeTurnsWithFilteredLabels = ({
  traces,
  inputProblem,
  allLabelPlacements,
  mergedLabelNetIdMap,
  paddingBuffer,
}: {
  traces: SolvedTracePath[]
  inputProblem: InputProblem
  allLabelPlacements: NetLabelPlacement[]
  mergedLabelNetIdMap: Record<string, Set<string>>
  paddingBuffer: number
}): SolvedTracePath[] | null => {
  let changesMade = false
  const obstacles = getObstacleRects(inputProblem)

  const newTraces = traces.map((trace) => {
    const originalPath = trace.tracePath
    const filteredLabels = allLabelPlacements.filter((label) => {
      const originalNetIds = mergedLabelNetIdMap[label.globalConnNetId]
      if (originalNetIds) {
        return !originalNetIds.has(trace.globalConnNetId)
      }
      return label.globalConnNetId !== trace.globalConnNetId
    })

    const labelBounds = filteredLabels.map((nl) => ({
      minX: nl.center.x - nl.width / 2 - paddingBuffer,
      maxX: nl.center.x + nl.width / 2 + paddingBuffer,
      minY: nl.center.y - nl.height / 2 - paddingBuffer,
      maxY: nl.center.y + nl.height / 2 + paddingBuffer,
    }))

    const newPath = minimizeTurns({
      path: originalPath,
      obstacles,
      labelBounds,
    })

    if (
      newPath.length !== originalPath.length ||
      newPath.some(
        (p, i) => p.x !== originalPath[i].x || p.y !== originalPath[i].y,
      )
    ) {
      changesMade = true
    }

    return {
      ...trace,
      tracePath: newPath,
    }
  })

  if (changesMade) {
    return newTraces
  } else {
    return null
  }
}
