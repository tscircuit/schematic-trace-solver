import type { FacingDirection } from "./dir"

export const dedupeOrientations = (orientations: FacingDirection[]) => [
  ...new Set(orientations),
]
