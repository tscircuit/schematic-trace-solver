import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"
import { dedupeOrientations } from "./dedupeOrientations"
import { normalizeFacingDirection } from "./normalizeFacingDirection"

export const getNetLabelOrientationConstraint = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
): FacingDirection[] | null => {
  const availableOrientations = inputProblem.availableNetLabelOrientations ?? {}
  for (const netId of getNetLabelOrientationConstraintKeys(
    inputProblem,
    label,
  )) {
    if (Object.hasOwn(availableOrientations, netId)) {
      return dedupeOrientations(
        (availableOrientations[netId] ?? [])
          .map(normalizeFacingDirection)
          .filter(
            (orientation): orientation is FacingDirection =>
              orientation !== undefined,
          ),
      )
    }
  }

  return null
}

const getNetLabelOrientationConstraintKeys = (
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

const dedupeStrings = (values: Array<string | undefined>) => [
  ...new Set(values.filter((value): value is string => value !== undefined)),
]
