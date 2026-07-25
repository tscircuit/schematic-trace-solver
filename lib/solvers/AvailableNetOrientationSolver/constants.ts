export const LABEL_SEARCH_STEP = 0.05
/**
 * Perpendicular offsets tried when a connector has to detour around a
 * blocking trace, smallest first so the route deviates as little as
 * possible. Multiples of `LABEL_SEARCH_STEP` to stay on the same grid the
 * label search uses.
 */
export const CONNECTOR_DETOUR_OFFSETS = [
  LABEL_SEARCH_STEP * 3,
  LABEL_SEARCH_STEP * 5,
  LABEL_SEARCH_STEP * 8,
  LABEL_SEARCH_STEP * 12,
  LABEL_SEARCH_STEP * 18,
]
export const WICK_CLEARANCE = 0.001
export const EPS = 1e-9
export const TRACE_BOUNDARY_TOLERANCE = WICK_CLEARANCE + EPS
export const CANDIDATE_SELECTED_COLOR = "blue"
export const CANDIDATE_REJECTED_COLOR = "red"
