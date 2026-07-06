import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { Point } from "@tscircuit/math-utils"
import { simplifyPath } from "./simplifyPath"

const EPS = 1e-9

type Segment = { a: Point; b: Point }

const coordKey = (value: number) => Number(value.toFixed(9)).toString()

const pointKey = (p: Point) => `${coordKey(p.x)},${coordKey(p.y)}`

const segmentKey = (a: Point, b: Point) => {
  const ak = pointKey(a)
  const bk = pointKey(b)
  return ak < bk ? `${ak}|${bk}` : `${bk}|${ak}`
}

const isSamePoint = (a: Point, b: Point) => pointKey(a) === pointKey(b)

const isVerticalSegment = ({ a, b }: Segment) => Math.abs(a.x - b.x) < EPS
const isHorizontalSegment = ({ a, b }: Segment) => Math.abs(a.y - b.y) < EPS

const segmentIsCovered = (candidate: Segment, seenSegments: Segment[]) => {
  if (isSamePoint(candidate.a, candidate.b)) return true

  for (const seen of seenSegments) {
    if (segmentKey(candidate.a, candidate.b) === segmentKey(seen.a, seen.b)) {
      return true
    }

    if (isVerticalSegment(candidate) && isVerticalSegment(seen)) {
      if (Math.abs(candidate.a.x - seen.a.x) >= EPS) continue
      const candidateMin = Math.min(candidate.a.y, candidate.b.y)
      const candidateMax = Math.max(candidate.a.y, candidate.b.y)
      const seenMin = Math.min(seen.a.y, seen.b.y)
      const seenMax = Math.max(seen.a.y, seen.b.y)
      if (candidateMin >= seenMin - EPS && candidateMax <= seenMax + EPS) {
        return true
      }
    }

    if (isHorizontalSegment(candidate) && isHorizontalSegment(seen)) {
      if (Math.abs(candidate.a.y - seen.a.y) >= EPS) continue
      const candidateMin = Math.min(candidate.a.x, candidate.b.x)
      const candidateMax = Math.max(candidate.a.x, candidate.b.x)
      const seenMin = Math.min(seen.a.x, seen.b.x)
      const seenMax = Math.max(seen.a.x, seen.b.x)
      if (candidateMin >= seenMin - EPS && candidateMax <= seenMax + EPS) {
        return true
      }
    }
  }

  return false
}

const netKeyForTrace = (trace: SolvedTracePath) =>
  trace.userNetId ?? trace.globalConnNetId ?? trace.dcConnNetId

const removeDuplicateEndpointSegments = (
  path: Point[],
  seenSegments: Segment[],
): Point[] => {
  let nextPath = [...path]

  while (
    nextPath.length > 2 &&
    segmentIsCovered({ a: nextPath[0]!, b: nextPath[1]! }, seenSegments)
  ) {
    nextPath = nextPath.slice(1)
  }

  while (
    nextPath.length > 2 &&
    segmentIsCovered(
      { a: nextPath[nextPath.length - 2]!, b: nextPath[nextPath.length - 1]! },
      seenSegments,
    )
  ) {
    nextPath = nextPath.slice(0, -1)
  }

  return nextPath
}

/**
 * MSP routing can produce multiple traces for the same net that share the same
 * physical segment near a common endpoint. Rendering each trace then draws an
 * apparent extra line. Trim duplicate same-net endpoint segments from later
 * traces while preserving each trace's connectivity.
 */
export const removeNetSegmentDuplicates = (
  traces: SolvedTracePath[],
): SolvedTracePath[] => {
  const seenSegmentsByNet = new Map<string, Segment[]>()

  return traces.map((trace) => {
    const netKey = netKeyForTrace(trace)
    const seenSegments = seenSegmentsByNet.get(netKey) ?? []
    seenSegmentsByNet.set(netKey, seenSegments)

    const cleanedPath = simplifyPath(
      removeDuplicateEndpointSegments(trace.tracePath, seenSegments),
    )

    for (let i = 0; i < cleanedPath.length - 1; i++) {
      const a = cleanedPath[i]!
      const b = cleanedPath[i + 1]!
      if (!isSamePoint(a, b)) {
        seenSegments.push({ a, b })
      }
    }

    return { ...trace, tracePath: cleanedPath }
  })
}
