import type { Point } from "@tscircuit/math-utils"
import type { FacingDirection } from "lib/utils/dir"
import { isYOrientation } from "./geometry"
import type { ChipSide } from "./types"

export const getPerpendicularOutwardDirection = ({
  chipSide,
  orientation,
}: {
  chipSide: ChipSide | null
  orientation: FacingDirection
}): Point => {
  if (isYOrientation(orientation)) {
    return chipSide === "left"
      ? { x: -1, y: 0 }
      : chipSide === "right"
        ? { x: 1, y: 0 }
        : { x: 0, y: 0 }
  }
  return chipSide === "bottom"
    ? { x: 0, y: -1 }
    : chipSide === "top"
      ? { x: 0, y: 1 }
      : { x: 0, y: 0 }
}
