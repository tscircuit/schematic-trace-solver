import { expect, test } from "bun:test"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { generatePerpendicularTraceDetours } from "lib/solvers/TraceCleanupSolver/sub-solver/generateLShapeRerouteCandidates"

test("perpendicular detours keep both terminals for horizontal and vertical crossings", () => {
  const crossings = [
    {
      path: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      obstacleStart: { x: 2, y: -1 },
      obstacleEnd: { x: 2, y: 1 },
    },
    {
      path: [
        { x: 0, y: 0 },
        { x: 0, y: 4 },
      ],
      obstacleStart: { x: -1, y: 2 },
      obstacleEnd: { x: 1, y: 2 },
    },
  ]

  for (const crossing of crossings) {
    const start = crossing.path[0]!
    const end = crossing.path[1]!
    const trace: SolvedTracePath = {
      mspPairId: "signal",
      dcConnNetId: "signal",
      globalConnNetId: "signal",
      pins: [
        { ...start, pinId: "source", chipId: "source-chip" },
        { ...end, pinId: "destination", chipId: "destination-chip" },
      ],
      pinIds: ["source", "destination"],
      mspConnectionPairIds: ["signal"],
      tracePath: crossing.path,
    }
    const candidates = generatePerpendicularTraceDetours({
      trace,
      segmentIndex: 0,
      obstacleStart: crossing.obstacleStart,
      obstacleEnd: crossing.obstacleEnd,
      chipBounds: [],
      clearance: 0.1,
    })

    expect(candidates).toHaveLength(4)
    for (const candidate of candidates) {
      expect(candidate.path[0]).toEqual(start)
      expect(candidate.path.at(-1)).toEqual(end)
      for (let index = 1; index < candidate.path.length; index++) {
        const previous = candidate.path[index - 1]!
        const current = candidate.path[index]!
        expect(previous.x === current.x || previous.y === current.y).toBe(true)
      }
    }
  }
})
