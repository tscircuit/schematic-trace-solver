import type { Point } from "@tscircuit/math-utils"

/**
 * Represents a solved trace segment, typically comprising a series of points
 * and associated with a specific net.
 */
export interface SolvedTrace {
  traceId?: string // Optional, unique identifier for the trace
  netId: string // The ID of the net this trace belongs to
  points: Point[] // Array of points defining the trace path
  // Add any other properties common to solved traces as needed (e.g., layer, width)
}
