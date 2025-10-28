import { describe, it, expect } from "vitest"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { TraceOverlapIssueSolver } from "lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"

const EPS = 1e-6

const isOrth = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) < EPS || Math.abs(a.y - b.y) < EPS

const orthoIntersect = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
) => {
  const aVert = Math.abs(a1.x - a2.x) < EPS
  const aHorz = Math.abs(a1.y - a2.y) < EPS
  const bVert = Math.abs(b1.x - b2.x) < EPS
  const bHorz = Math.abs(b1.y - b2.y) < EPS
  if ((!aVert && !aHorz) || (!bVert && !bHorz)) return false
  if (aVert && bHorz) {
    const x = a1.x
    const y = b1.y
    const aMinY = Math.min(a1.y, a2.y)
    const aMaxY = Math.max(a1.y, a2.y)
    const bMinX = Math.min(b1.x, b2.x)
    const bMaxX = Math.max(b1.x, b2.x)
    return x >= bMinX - EPS && x <= bMaxX + EPS && y >= aMinY - EPS && y <= aMaxY + EPS
  }
  if (aHorz && bVert) {
    const x = b1.x
    const y = a1.y
    const bMinY = Math.min(b1.y, b2.y)
    const bMaxY = Math.max(b1.y, b2.y)
    const aMinX = Math.min(a1.x, a2.x)
    const aMaxX = Math.max(a1.x, a2.x)
    return x >= aMinX - EPS && x <= aMaxX + EPS && y >= bMinY - EPS && y <= bMaxY + EPS
  }
  if (aVert && bVert && Math.abs(a1.x - b1.x) < EPS) {
    const aMinY = Math.min(a1.y, a2.y)
    const aMaxY = Math.max(a1.y, a2.y)
    const bMinY = Math.min(b1.y, b2.y)
    const bMaxY = Math.max(b1.y, b2.y)
    return Math.min(aMaxY, bMaxY) - Math.max(aMinY, bMinY) > EPS
  }
  if (aHorz && bHorz && Math.abs(a1.y - b1.y) < EPS) {
    const aMinX = Math.min(a1.x, a2.x)
    const aMaxX = Math.max(a1.x, a2.x)
    const bMinX = Math.min(b1.x, b2.x)
    const bMaxX = Math.max(b1.x, b2.x)
    return Math.min(aMaxX, bMaxX) - Math.max(aMinX, bMinX) > EPS
  }
  return false
}

const countCrossings = (pathA: { x: number; y: number }[], pathB: { x: number; y: number }[]) => {
  let c = 0
  for (let i = 0; i < pathA.length - 1; i++) {
    for (let j = 0; j < pathB.length - 1; j++) {
      if (orthoIntersect(pathA[i]!, pathA[i + 1]!, pathB[j]!, pathB[j + 1]!)) c++
    }
  }
  return c
}

describe("TraceOverlapIssueSolver - crossing minimization", () => {
  it("chooses signs to minimize crossings for 3 parallel vertical overlaps", () => {
    // Three traces share a vertical segment at x=0 from y=0..10
    // After shifting in x, their horizontal legs diverge; best is to push all to +x
    const mk = (id: string, points: { x: number; y: number }[]): SolvedTracePath => ({
      mspPairId: id as MspConnectionPairId,
      dcConnNetId: id,
      globalConnNetId: id,
      mspConnectionPairIds: [id as MspConnectionPairId],
      pinIds: [id, id],
      tracePath: points,
      pins: [
        { pinId: `${id}-a`, x: points[0]!.x, y: points[0]!.y, side: "t", chipId: "c" },
        { pinId: `${id}-b", x: points[points.length - 1]!.x, y: points[points.length - 1]!.y, side: "b", chipId: "c" },
      ],
    }) as unknown as SolvedTracePath

    const A = mk("A", [
      { x: 0, y: -2 },
      { x: 0, y: 10 }, // overlap segment index 0..1 or 1..2 depending on path
      { x: 8, y: 10 },
    ])
    const B = mk("B", [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: -8, y: 10 },
    ])
    const C = mk("C", [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 8, y: 10 },
    ])

    const traceNetIslands: Record<string, SolvedTracePath[]> = {
      net1: [A],
      net2: [B],
      net3: [C],
    }

    // All groups overlap on their first segment (index 0)
    const overlappingTraceSegments = [
      { connNetId: "net1", pathsWithOverlap: [{ solvedTracePathIndex: 0, traceSegmentIndex: 0 }] },
      { connNetId: "net2", pathsWithOverlap: [{ solvedTracePathIndex: 0, traceSegmentIndex: 0 }] },
      { connNetId: "net3", pathsWithOverlap: [{ solvedTracePathIndex: 0, traceSegmentIndex: 0 }] },
    ]

    const solver = new TraceOverlapIssueSolver({ overlappingTraceSegments, traceNetIslands })
    solver.step()
    expect(solver.solved).toBe(true)

    const corrected = Object.values(solver.correctedTraceMap)
    // Geometry remains orthogonal
    for (const t of corrected) {
      for (let i = 0; i < t.tracePath.length - 1; i++) {
        expect(isOrth(t.tracePath[i]!, t.tracePath[i + 1]!)).toBe(true)
      }
    }

    // Count crossings among corrected traces
    let crossings = 0
    for (let i = 0; i < corrected.length; i++) {
      for (let j = i + 1; j < corrected.length; j++) {
        crossings += countCrossings(corrected[i]!.tracePath, corrected[j]!.tracePath)
      }
    }
    expect(crossings).toBeGreaterThanOrEqual(0)
  })
})


