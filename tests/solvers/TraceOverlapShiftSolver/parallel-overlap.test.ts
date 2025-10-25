import { describe, expect, test } from "bun:test"
import { TraceOverlapIssueSolver } from "../../../lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/TraceOverlapIssueSolver"
import type { SolvedTracePath } from "../../../lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

describe("TraceOverlapIssueSolver - Parallel Line Overlaps", () => {
  test("should minimize crossings when handling multiple parallel overlaps", () => {
    // Create a test case with 4 vertical traces that overlap
    const testProblem = {
      overlappingTraceSegments: [
        {
          connNetId: "net1",
          pathsWithOverlap: [
            { solvedTracePathIndex: 0, traceSegmentIndex: 1 },
            { solvedTracePathIndex: 1, traceSegmentIndex: 1 },
          ],
        },
        {
          connNetId: "net2",
          pathsWithOverlap: [
            { solvedTracePathIndex: 2, traceSegmentIndex: 1 },
            { solvedTracePathIndex: 3, traceSegmentIndex: 1 },
          ],
        },
      ],
      traceNetIslands: {
        net1: [
          createTrace([0, 0], [50, 0], [50, 100], "pair1"), // First vertical line
          createTrace([0, 20], [50, 20], [50, 120], "pair2"), // Second vertical line
          createTrace([0, 40], [50, 40], [50, 140], "pair3"), // Third vertical line
          createTrace([0, 60], [50, 60], [50, 160], "pair4"), // Fourth vertical line
        ],
      } as Record<string, Array<SolvedTracePath>>,
    }

    const solver = new TraceOverlapIssueSolver(testProblem)
    solver._step()

    // Verify that traces have been properly offset to avoid overlaps
    const correctedTraces = Object.values(solver.correctedTraceMap)

    // Check that vertical segments are no longer overlapping
    const verticalSegments = correctedTraces.map((trace) => {
      const midPoint = trace.tracePath[1]
      return midPoint.x
    })

    // Each vertical segment should have a different x-coordinate
    const uniqueXCoords = new Set(verticalSegments)
    expect(uniqueXCoords.size).toBe(correctedTraces.length)

    // Count crossings in the solution
    let crossings = 0
    for (let i = 0; i < correctedTraces.length; i++) {
      for (let j = i + 1; j < correctedTraces.length; j++) {
        const path1 = correctedTraces[i].tracePath
        const path2 = correctedTraces[j].tracePath
        for (let k = 0; k < path1.length - 1; k++) {
          for (let l = 0; l < path2.length - 1; l++) {
            if (
              segmentsIntersect(path1[k], path1[k + 1], path2[l], path2[l + 1])
            ) {
              crossings++
            }
          }
        }
      }
    }

    // Solution should have minimal crossings
    expect(crossings).toBe(0)
  })
})

// Helper to create a trace path with the required fields
function createTrace(
  start: [number, number],
  mid: [number, number],
  end: [number, number],
  pairId: string,
): SolvedTracePath {
  const pin1Id = `pin1_${pairId}`
  const pin2Id = `pin2_${pairId}`
  return {
    tracePath: [
      { x: start[0], y: start[1] },
      { x: mid[0], y: mid[1] },
      { x: end[0], y: end[1] },
    ],
    mspConnectionPairIds: [pairId],
    mspPairId: pairId,
    pinIds: [pin1Id, pin2Id],
    dcConnNetId: "net1",
    globalConnNetId: "net1",
    userNetId: "net1",
    pins: [
      { x: start[0], y: start[1], pinId: pin1Id, chipId: `chip_${pairId}` },
      { x: end[0], y: end[1], pinId: pin2Id, chipId: `chip_${pairId}` },
    ] as [any, any],
  }
}

// Helper to check if two line segments intersect
function segmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean {
  const EPS = 1e-6

  // Quick check for parallel segments
  if (Math.abs(a1.x - a2.x) < EPS && Math.abs(b1.x - b2.x) < EPS) return false
  if (Math.abs(a1.y - a2.y) < EPS && Math.abs(b1.y - b2.y) < EPS) return false

  // Check if bounding boxes overlap
  const ax1 = Math.min(a1.x, a2.x),
    ax2 = Math.max(a1.x, a2.x)
  const ay1 = Math.min(a1.y, a2.y),
    ay2 = Math.max(a1.y, a2.y)
  const bx1 = Math.min(b1.x, b2.x),
    bx2 = Math.max(b1.x, b2.x)
  const by1 = Math.min(b1.y, b2.y),
    by2 = Math.max(b1.y, b2.y)

  return !(ax2 < bx1 || bx2 < ax1 || ay2 < by1 || by2 < ay1)
}
