export type FacingDirection = "x+" | "x-" | "y+" | "y-"
export const dir = (
  facingDirection: FacingDirection,
): { x: number; y: number } => {
  switch (facingDirection) {
    case "x+":
      return { x: 1, y: 0 }
    case "x-":
      return { x: -1, y: 0 }
    case "y+":
      return { x: 0, y: 1 }
    case "y-":
      return { x: 0, y: -1 }
  }
  throw new Error(`Invalid facing direction: ${facingDirection}`)
}
