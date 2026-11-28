import type { Point } from "@tscircuit/math-utils"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { dir, type FacingDirection } from "lib/utils/dir"
import { EPS, LABEL_SEARCH_STEP } from "./constants"
import { simplifyOrthogonalPath, tracePathCrossesAnyTrace } from "./geometry"

export const findDoglegPortOnlyConnectorTrace = ({
  labelAnchor,
  targetAnchor,
  orientation,
  chipOutwardDir,
  traceMap,
  isValidConnectorTrace,
}: {
  labelAnchor: Point
  targetAnchor: Point
  orientation: FacingDirection
  chipOutwardDir: Point
  traceMap: Record<MspConnectionPairId, SolvedTracePath>
  isValidConnectorTrace: (path: Point[]) => boolean
}): Point[] | null => {
  const orientDir = dir(orientation)
  const totalVerticalDistance = (targetAnchor.y - labelAnchor.y) * orientDir.y
  if (chipOutwardDir.x === 0 || totalVerticalDistance <= LABEL_SEARCH_STEP) {
    return null
  }

  const outwardX = labelAnchor.x + chipOutwardDir.x * LABEL_SEARCH_STEP
  for (
    let step = LABEL_SEARCH_STEP;
    step <= totalVerticalDistance + EPS;
    step += LABEL_SEARCH_STEP
  ) {
    const bendY = labelAnchor.y + orientDir.y * step
    const doglegTrace = simplifyOrthogonalPath([
      labelAnchor,
      { x: outwardX, y: labelAnchor.y },
      { x: outwardX, y: bendY },
      { x: targetAnchor.x, y: bendY },
      targetAnchor,
    ])
    if (
      isValidConnectorTrace(doglegTrace) &&
      !tracePathCrossesAnyTrace(doglegTrace, traceMap)
    ) {
      return doglegTrace
    }
  }

  return null
}
