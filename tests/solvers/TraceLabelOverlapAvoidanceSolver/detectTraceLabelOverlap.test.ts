import { test, expect } from "bun:test"
import { detectTraceLabelOverlap } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/detectTraceLabelOverlap"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

test("detectTraceLabelOverlap returns empty array when no overlaps", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    } as any,
  ]

  const netLabels: NetLabelPlacement[] = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      anchor: { x: 5, y: 5 },
      center: { x: 5, y: 5 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    } as any,
  ]

  const result = detectTraceLabelOverlap({ traces, netLabels })

  expect(result).toEqual([])
})

test("detectTraceLabelOverlap finds overlaps", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    } as any,
  ]

  const netLabels: NetLabelPlacement[] = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      anchor: { x: 5, y: 0 }, // on the trace path
      center: { x: 5, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    } as any,
  ]

  const result = detectTraceLabelOverlap({ traces, netLabels })

  expect(result.length).toBeGreaterThan(0)
})

test("detectTraceLabelOverlap ignores same-net trace-label pairs", () => {
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "trace1",
      mspConnectionPairIds: [],
      pinIds: [],
      tracePath: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      globalConnNetId: "global-net-1", // Same net as label
    } as any,
  ]

  const netLabels: NetLabelPlacement[] = [
    {
      netId: "net1",
      globalConnNetId: "global-net-1", // Same net as trace
      chipId: "chip1",
      pinId: "pin1",
      anchor: { x: 5, y: 0 },
      center: { x: 5, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    } as any,
  ]

  const result = detectTraceLabelOverlap({ traces, netLabels })

  // Same-net connections should not be considered overlaps
  expect(result).toEqual([])
})
