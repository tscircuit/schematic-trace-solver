import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { TraceAnchoredNetLabelOverlapSolver } from "lib/solvers/TraceAnchoredNetLabelOverlapSolver/TraceAnchoredNetLabelOverlapSolver"

test("counts host-trace work for non-overlapping net labels", () => {
  let traceEligibilityReads = 0
  const traces: SolvedTracePath[] = []
  const netLabelPlacements: NetLabelPlacement[] = []
  for (let index = 0; index < 32; index++) {
    const netId = `net${index}`
    const y = index * 2
    const source = { pinId: `${netId}-source`, chipId: "source", x: 0, y }
    const target = { pinId: `${netId}-target`, chipId: "target", x: 2, y }
    const pinIds = [source.pinId, target.pinId]
    traces.push({
      mspPairId: netId,
      dcConnNetId: netId,
      globalConnNetId: netId,
      pins: [source, target],
      get pinIds() {
        traceEligibilityReads++
        return pinIds
      },
      mspConnectionPairIds: [netId],
      tracePath: [source, target],
    })
    netLabelPlacements.push({
      netId,
      globalConnNetId: netId,
      pinIds,
      mspConnectionPairIds: [netId],
      anchorPoint: { x: 1, y },
      center: { x: 1.5, y },
      width: 1,
      height: 0.5,
      orientation: "x+",
    })
  }

  const solver = new TraceAnchoredNetLabelOverlapSolver({
    inputProblem: {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: {},
    },
    traces,
    netLabelPlacements,
  })
  const initialPlacements = structuredClone(netLabelPlacements)
  solver.solve()

  expect(solver.solved).toBe(true)
  expect(solver.getOutput().netLabelPlacements).toEqual(initialPlacements)
  expect(traceEligibilityReads).toMatchInlineSnapshot(`15872`)
})
