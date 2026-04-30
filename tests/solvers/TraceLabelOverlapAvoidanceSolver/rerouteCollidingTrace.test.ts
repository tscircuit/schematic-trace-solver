import { test, expect } from "bun:test"
import { generateRerouteCandidates } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/rerouteCollidingTrace"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

test("generateRerouteCandidates returns array", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ],
    globalConnNetId: "net1",
  } as any

  const label: NetLabelPlacement = {
    netId: "net1",
    globalConnNetId: "global-1",
    chipId: "chip1",
    pinId: "pin1",
    anchor: { x: 5, y: 0 },
    center: { x: 5, y: 0 },
    width: 0.5,
    height: 0.2,
    facingDirection: "x+",
  } as any

  const result = generateRerouteCandidates({
    trace,
    label,
    problem: {} as any,
    paddingBuffer: 0.5,
    detourCount: 1,
  })

  expect(Array.isArray(result)).toBe(true)
})

test("generateRerouteCandidates handles same-net trace-label", () => {
  const trace: SolvedTracePath = {
    mspPairId: "trace1",
    mspConnectionPairIds: [],
    pinIds: [],
    tracePath: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ],
    globalConnNetId: "global-net-1",
  } as any

  const label: NetLabelPlacement = {
    netId: "net1",
    globalConnNetId: "global-net-1", // Same net
    chipId: "chip1",
    pinId: "pin1",
    anchor: { x: 5, y: 0 },
    center: { x: 5, y: 0 },
    width: 0.5,
    height: 0.2,
    facingDirection: "x+",
  } as any

  const result = generateRerouteCandidates({
    trace,
    label,
    problem: {} as any,
    paddingBuffer: 0.5,
    detourCount: 1,
  })

  // Same-net should return simplified path only
  expect(result.length).toBe(1)
})
