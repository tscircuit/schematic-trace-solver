import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dedupeStrings } from "./dedupeStrings"

export const getOrientationConstraintKeys = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
) =>
  dedupeStrings([
    label.netId,
    label.globalConnNetId,
    ...inputProblem.netConnections
      .filter((connection) =>
        label.pinIds.some((pinId) => connection.pinIds.includes(pinId)),
      )
      .map((connection) => connection.netId),
  ])
