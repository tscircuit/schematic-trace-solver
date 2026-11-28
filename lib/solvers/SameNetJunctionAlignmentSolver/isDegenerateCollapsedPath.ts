import type { Point } from "@tscircuit/math-utils"
import { pointsEqual } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"

export const isDegenerateCollapsedPath = (path: Point[]) =>
  path.length < 2 || (path.length === 2 && pointsEqual(path[0]!, path[1]!))
