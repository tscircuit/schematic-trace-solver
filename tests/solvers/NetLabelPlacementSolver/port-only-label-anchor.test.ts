import { expect, test } from "bun:test"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("final port-only net label output touches its anchor", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const portOnlyPlacement: NetLabelPlacement = {
    globalConnNetId: "SIGNAL",
    netId: "SIGNAL",
    mspConnectionPairIds: [],
    pinIds: ["pin1"],
    orientation: "x+",
    anchorPoint: { x: 0.5, y: 0 },
    width: 0.4,
    height: 0.2,
    center: { x: 0.701, y: 0 },
  }
  const solver = new InlineNetLabelSolver({
    inputProblem,
    traces: [],
    netLabelPlacements: [portOnlyPlacement],
  })

  solver.solve()

  const [label] = solver.getOutput().netLabelPlacements
  expect(label).toBeDefined()
  expect(label!.center.x - label!.width / 2).toBeCloseTo(
    label!.anchorPoint.x,
    12,
  )
})
