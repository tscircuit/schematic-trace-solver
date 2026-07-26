import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const EPS = 1e-9

const isHorizontal = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.abs(a.y - b.y) < EPS

const isVertical = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < EPS

type Segment = {
  a: { x: number; y: number }
  b: { x: number; y: number }
  traceId: string
  netId: string
  segmentIndex: number
}

/**
 * True when a horizontal and a vertical segment properly cross — they share an
 * interior point. Touching at an endpoint is excluded, since traces on the same
 * net legitimately meet there.
 */
const properlyCrosses = (h: Segment, v: Segment) => {
  const y = h.a.y
  const x = v.a.x

  const withinH =
    x > Math.min(h.a.x, h.b.x) + EPS && x < Math.max(h.a.x, h.b.x) - EPS
  const withinV =
    y > Math.min(v.a.y, v.b.y) + EPS && y < Math.max(v.a.y, v.b.y) - EPS

  return withinH && withinV
}

/**
 * Counts places where traces belonging to *different* nets cross each other.
 *
 * A schematic can't always avoid these, but each one is a readability cost, so
 * this is useful as a regression guard: a change to the routing or cleanup
 * solvers should not silently increase the count on a known board.
 */
export const getTraceCrossings = (traces: SolvedTracePath[]) => {
  const segments: Segment[] = []

  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      segments.push({
        a: trace.tracePath[i]!,
        b: trace.tracePath[i + 1]!,
        traceId: trace.mspPairId,
        netId: trace.globalConnNetId,
        segmentIndex: i,
      })
    }
  }

  const crossings: Array<{
    aTraceId: string
    aNetId: string
    aSegmentIndex: number
    bTraceId: string
    bNetId: string
    bSegmentIndex: number
    at: { x: number; y: number }
  }> = []

  for (let i = 0; i < segments.length; i++) {
    for (let k = i + 1; k < segments.length; k++) {
      const s1 = segments[i]!
      const s2 = segments[k]!
      if (s1.netId === s2.netId) continue

      let h: Segment | null = null
      let v: Segment | null = null
      if (isHorizontal(s1.a, s1.b) && isVertical(s2.a, s2.b)) {
        h = s1
        v = s2
      } else if (isVertical(s1.a, s1.b) && isHorizontal(s2.a, s2.b)) {
        h = s2
        v = s1
      }
      if (!h || !v || !properlyCrosses(h, v)) continue

      crossings.push({
        aTraceId: s1.traceId,
        aNetId: s1.netId,
        aSegmentIndex: s1.segmentIndex,
        bTraceId: s2.traceId,
        bNetId: s2.netId,
        bSegmentIndex: s2.segmentIndex,
        at: { x: v.a.x, y: h.a.y },
      })
    }
  }

  return crossings
}

/**
 * Counts places where segments of *different* nets run along each other and
 * share more than a single point — a collinear overlap.
 *
 * This is the companion measurement to {@link getTraceCrossings}, and the two
 * are needed together. A solver can always drive the crossing count down by
 * letting two nets lie on top of one another instead, which reads as one line
 * and hides a connection the schematic is supposed to show. Counting only
 * crossings would score that as an improvement.
 */
export const getTraceOverlaps = (traces: SolvedTracePath[]) => {
  const segments: Segment[] = []

  for (const trace of traces) {
    for (let i = 0; i < trace.tracePath.length - 1; i++) {
      segments.push({
        a: trace.tracePath[i]!,
        b: trace.tracePath[i + 1]!,
        traceId: trace.mspPairId,
        netId: trace.globalConnNetId,
        segmentIndex: i,
      })
    }
  }

  const overlaps: Array<{
    aTraceId: string
    aNetId: string
    aSegmentIndex: number
    bTraceId: string
    bNetId: string
    bSegmentIndex: number
    axis: "horizontal" | "vertical"
    length: number
  }> = []

  for (let i = 0; i < segments.length; i++) {
    for (let k = i + 1; k < segments.length; k++) {
      const s1 = segments[i]!
      const s2 = segments[k]!
      if (s1.netId === s2.netId) continue

      let axis: "horizontal" | "vertical" | null = null
      let length = 0

      if (
        isHorizontal(s1.a, s1.b) &&
        isHorizontal(s2.a, s2.b) &&
        Math.abs(s1.a.y - s2.a.y) < EPS
      ) {
        const low = Math.max(Math.min(s1.a.x, s1.b.x), Math.min(s2.a.x, s2.b.x))
        const high = Math.min(
          Math.max(s1.a.x, s1.b.x),
          Math.max(s2.a.x, s2.b.x),
        )
        // A shared endpoint is a touch, not an overlap.
        if (high - low > EPS) {
          axis = "horizontal"
          length = high - low
        }
      } else if (
        isVertical(s1.a, s1.b) &&
        isVertical(s2.a, s2.b) &&
        Math.abs(s1.a.x - s2.a.x) < EPS
      ) {
        const low = Math.max(Math.min(s1.a.y, s1.b.y), Math.min(s2.a.y, s2.b.y))
        const high = Math.min(
          Math.max(s1.a.y, s1.b.y),
          Math.max(s2.a.y, s2.b.y),
        )
        if (high - low > EPS) {
          axis = "vertical"
          length = high - low
        }
      }

      if (!axis) continue

      overlaps.push({
        aTraceId: s1.traceId,
        aNetId: s1.netId,
        aSegmentIndex: s1.segmentIndex,
        bTraceId: s2.traceId,
        bNetId: s2.netId,
        bSegmentIndex: s2.segmentIndex,
        axis,
        length,
      })
    }
  }

  return overlaps
}
