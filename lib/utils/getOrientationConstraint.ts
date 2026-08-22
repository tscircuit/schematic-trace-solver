import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dedupeOrientations } from "./dedupeOrientations"
import type { FacingDirection } from "./dir"
import { getOrientationConstraintKeys } from "./getOrientationConstraintKeys"
import { normalizeFacingDirection } from "./normalizeFacingDirection"

export const getOrientationConstraint = (
  inputProblem: InputProblem,
  label: NetLabelPlacement,
): FacingDirection[] | null => {
  const availableOrientations = inputProblem.availableNetLabelOrientations ?? {}
  for (const netId of getOrientationConstraintKeys(inputProblem, label)) {
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
