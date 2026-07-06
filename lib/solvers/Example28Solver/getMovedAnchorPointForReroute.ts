import type { Point } from "@tscircuit/math-utils"
import {
  findPreferredReroutedSegment,
  findSegmentContainingPoint,
  projectPointToPath,
  projectPointToSegment,
} from "./geometry"

export const getMovedAnchorPointForReroute = (
  anchorPoint: Point,
  originalTracePath: Point[],
  reroutedTracePath: Point[],
) => {
  const originalSegment = findSegmentContainingPoint(
    originalTracePath,
    anchorPoint,
  )
  if (!originalSegment) return null

  const preferredSegment = findPreferredReroutedSegment(
    reroutedTracePath,
    originalSegment.index,
    originalTracePath.length - 1,
    originalSegment.orientation,
    anchorPoint,
  )

  if (!preferredSegment) {
    return projectPointToPath(anchorPoint, reroutedTracePath)
  }

  return projectPointToSegment(
    anchorPoint,
    preferredSegment.start,
    preferredSegment.end,
  )
}
