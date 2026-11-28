import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { getCenterFromAnchor } from "./SingleNetLabelPlacementSolver/geometry"
import type {
  NetLabelPlacement,
  OverlappingSameNetTraceGroup,
} from "./NetLabelPlacementSolver"

interface TestedLabelCandidate {
  width: number
  height: number
  anchor: { x: number; y: number }
  orientation: FacingDirection
  status:
    | "ok"
    | "chip-collision"
    | "trace-collision"
    | "text-collision"
    | "parallel-to-segment"
}

export function createFallbackTraceGroupLabelPlacement(params: {
  inputProblem: InputProblem
  group: OverlappingSameNetTraceGroup
  testedCandidates: TestedLabelCandidate[]
}): NetLabelPlacement | null {
  const { inputProblem, group, testedCandidates } = params
  const hostTrace = group.overlappingTraces
  if (!hostTrace || !group.netId || testedCandidates.length === 0) return null
  if (hostTrace.pins[0].chipId === hostTrace.pins[1].chipId) return null

  const netConnection = inputProblem.netConnections.find(
    (connection) => connection.netId === group.netId,
  )
  if (
    !netConnection ||
    netConnection.allowInlineNetLabel ||
    netConnection.isGround
  ) {
    return null
  }

  const preferredOrientations =
    inputProblem.availableNetLabelOrientations[group.netId] ?? []
  const requiredOrientation = preferredOrientations[0]
  if (preferredOrientations.length !== 1 || requiredOrientation !== "y+") {
    return null
  }

  const selectedCandidate =
    testedCandidates.find(
      (candidate) =>
        candidate.status === "trace-collision" &&
        candidate.orientation === requiredOrientation,
    ) ??
    testedCandidates.find(
      (candidate) => candidate.status === "trace-collision",
    ) ??
    testedCandidates.find(
      (candidate) => candidate.orientation === requiredOrientation,
    ) ??
    testedCandidates[0]!

  const center = getCenterFromAnchor(
    selectedCandidate.anchor,
    selectedCandidate.orientation,
    selectedCandidate.width,
    selectedCandidate.height,
  )

  return {
    globalConnNetId: group.globalConnNetId,
    dcConnNetId: hostTrace.dcConnNetId,
    netId: group.netId,
    netLabelText: group.netLabelText,
    mspConnectionPairIds: group.mspConnectionPairIds ?? [hostTrace.mspPairId],
    pinIds: [hostTrace.pins[0].pinId, hostTrace.pins[1].pinId],
    orientation: selectedCandidate.orientation,
    anchorPoint: selectedCandidate.anchor,
    width: selectedCandidate.width,
    height: selectedCandidate.height,
    center,
    requiresCollisionResolution: true,
  }
}
