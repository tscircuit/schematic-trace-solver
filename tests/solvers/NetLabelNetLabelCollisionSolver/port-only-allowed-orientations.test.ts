import { expect, test } from "bun:test"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

test("respects ground, signal, empty and missing constraints for port-only placements", () => {
  const label: NetLabelPlacement = {
    netId: "NET",
    globalConnNetId: "connectivity",
    pinIds: ["U1.1"],
    mspConnectionPairIds: [],
    orientation: "y-",
    anchorPoint: { x: 0, y: 0 },
    center: { x: 0, y: -0.2 },
    width: 0.6,
    height: 0.4,
  }
  for (const orientations of [
    ["y-"],
    ["x-", "x+"],
    [],
    undefined,
  ] satisfies Array<FacingDirection[] | undefined>) {
    const inputProblem: InputProblem = {
      chips: [],
      directConnections: [],
      netConnections: [],
      availableNetLabelOrientations: orientations ? { NET: orientations } : {},
    }
    const solver = new NetLabelNetLabelCollisionSolver({
      inputProblem,
      traces: [],
      netLabelPlacements: [label],
    })
    const placements = solver.getNearbyValidPlacements(label, 1)
    expect(placements.map((placement) => placement.orientation).sort()).toEqual(
      [...(orientations ?? ["x+", "x-", "y+", "y-"])].sort(),
    )
  }
})
