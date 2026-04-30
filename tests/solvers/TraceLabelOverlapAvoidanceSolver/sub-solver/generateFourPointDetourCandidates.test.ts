import { test, expect } from "bun:test"
import { generateFourPointDetourCandidates } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/tryFourPointDetour"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

test("generateFourPointDetourCandidates returns array", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
  } as any

  const label: NetLabelPlacement = {
    netId: "net1",
    globalConnNetId: "global-net-1",
    chipId: "chip1",
    pinId: "pin1",
    anchor: { x: 5, y: 0 },
    facingDirection: "x+",
  } as any

  const result = generateFourPointDetourCandidates({
    initialTrace: trace,
    label,
    labelBounds: { minX: 4, maxX: 6, minY: -1, maxY: 1 },
    paddingBuffer: 0.5,
    detourCount: 1,
  })

  expect(Array.isArray(result)).toBe(true)
})
