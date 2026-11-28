import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { INLINE_NET_LABEL_STUB_TRACE_CLEARANCE } from "./InlineNetLabelSolver"

const GEOMETRY_EPSILON = 1e-6

/**
 * Shortens an axis-aligned terminal stub before the first unrelated trace.
 * Coordinates are schematic-world millimetres with +x right and +y up.
 */
export const getCollisionLimitedTerminalStubEnd = ({
  start,
  intendedEnd,
  minimumLength,
  traces,
  ownGlobalConnNetId,
  ignoredTraceIds,
}: {
  start: Point
  intendedEnd: Point
  minimumLength: number
  traces: SolvedTracePath[]
  ownGlobalConnNetId: string
  ignoredTraceIds: Set<string>
}): Point | null => {
  const isHorizontal =
    Math.abs(intendedEnd.x - start.x) >= Math.abs(intendedEnd.y - start.y)
  const alongAxis = isHorizontal ? "x" : "y"
  const acrossAxis = isHorizontal ? "y" : "x"
  const direction = Math.sign(intendedEnd[alongAxis] - start[alongAxis]) || 1
  const intendedLength = Math.abs(intendedEnd[alongAxis] - start[alongAxis])
  let availableLength = intendedLength

  for (const trace of traces) {
    if (ignoredTraceIds.has(trace.mspPairId)) continue
    if (trace.globalConnNetId === ownGlobalConnNetId) continue

    for (
      let segmentIndex = 0;
      segmentIndex < trace.tracePath.length - 1;
      segmentIndex++
    ) {
      const segmentStart = trace.tracePath[segmentIndex]
      const segmentEnd = trace.tracePath[segmentIndex + 1]
      if (!segmentStart || !segmentEnd) continue
      const startAlong =
        (segmentStart[alongAxis] - start[alongAxis]) * direction
      const endAlong = (segmentEnd[alongAxis] - start[alongAxis]) * direction
      const startAcross = segmentStart[acrossAxis] - start[acrossAxis]
      const endAcross = segmentEnd[acrossAxis] - start[acrossAxis]
      const minAlong = Math.min(startAlong, endAlong)
      const maxAlong = Math.max(startAlong, endAlong)
      const minAcross = Math.min(startAcross, endAcross)
      const maxAcross = Math.max(startAcross, endAcross)

      let collisionDistance: number | undefined
      const isCollinear =
        Math.abs(startAcross) <= GEOMETRY_EPSILON &&
        Math.abs(endAcross) <= GEOMETRY_EPSILON
      if (
        isCollinear &&
        maxAlong >= -GEOMETRY_EPSILON &&
        minAlong <=
          intendedLength +
            INLINE_NET_LABEL_STUB_TRACE_CLEARANCE +
            GEOMETRY_EPSILON
      ) {
        collisionDistance = Math.max(0, minAlong)
      } else {
        const crossesStubAxis =
          minAcross <= GEOMETRY_EPSILON && maxAcross >= -GEOMETRY_EPSILON
        const perpendicularAlong = (startAlong + endAlong) / 2
        if (
          crossesStubAxis &&
          Math.abs(startAlong - endAlong) <= GEOMETRY_EPSILON &&
          perpendicularAlong >= -GEOMETRY_EPSILON &&
          perpendicularAlong <=
            intendedLength +
              INLINE_NET_LABEL_STUB_TRACE_CLEARANCE +
              GEOMETRY_EPSILON
        ) {
          collisionDistance = Math.max(0, perpendicularAlong)
        }
      }

      if (collisionDistance !== undefined) {
        availableLength = Math.min(
          availableLength,
          collisionDistance - INLINE_NET_LABEL_STUB_TRACE_CLEARANCE,
        )
      }
    }
  }

  if (availableLength + GEOMETRY_EPSILON < minimumLength) return null

  return isHorizontal
    ? { x: start.x + direction * availableLength, y: start.y }
    : { x: start.x, y: start.y + direction * availableLength }
}
