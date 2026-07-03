import type { FacingDirection } from "lib/utils/dir"

export const dedupeOrientations = (orientations: FacingDirection[]) => [
  ...new Set(orientations),
]
