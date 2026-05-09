import type { FacingDirection } from "lib/utils/dir"

export function getNetLabelStrokeColorForOrientation(
  orientation: FacingDirection,
  fallbackColor: string,
) {
  switch (orientation) {
    case "y+":
      return "red"
    case "y-":
      return "black"
    default:
      return fallbackColor
  }
}
