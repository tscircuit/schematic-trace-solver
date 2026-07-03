import type { FacingDirection } from "lib/utils/dir"

export const normalizeFacingDirection = (
  value: string,
): FacingDirection | undefined => {
  switch (value) {
    case "x+":
    case "+x":
      return "x+"
    case "x-":
    case "-x":
      return "x-"
    case "y+":
    case "+y":
      return "y+"
    case "y-":
    case "-y":
      return "y-"
  }
}
