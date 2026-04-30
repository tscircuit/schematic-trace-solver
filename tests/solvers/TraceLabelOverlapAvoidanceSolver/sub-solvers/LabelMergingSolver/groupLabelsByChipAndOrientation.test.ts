import { test, expect } from "bun:test"
import { groupLabelsByChipAndOrientation } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/groupLabelsByChipAndOrientation"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

test("groupLabelsByChipAndOrientation returns empty for empty labels", () => {
  const result = groupLabelsByChipAndOrientation({ labels: [], chips: [] })
  expect(Object.keys(result)).toHaveLength(0)
})

test("groupLabelsByChipAndOrientation groups by chip and orientation", () => {
  const labels: NetLabelPlacement[] = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      pinIds: ["chip1.pin1"],
      anchor: { x: 0, y: 0 },
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
      orientation: "left",
    } as any,
    {
      netId: "net2",
      globalConnNetId: "global-2",
      chipId: "chip1",
      pinId: "pin2",
      pinIds: ["chip1.pin2"],
      anchor: { x: 0, y: 1 },
      center: { x: 0, y: 1 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
      orientation: "left",
    } as any,
  ]

  const result = groupLabelsByChipAndOrientation({ labels, chips: [] })

  expect(result["chip1-left"]).toHaveLength(2)
})

test("groupLabelsByChipAndOrientation separates different orientations", () => {
  const labels: NetLabelPlacement[] = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      pinIds: ["chip1.pin1"],
      anchor: { x: 0, y: 0 },
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
      orientation: "left",
    } as any,
    {
      netId: "net2",
      globalConnNetId: "global-2",
      chipId: "chip1",
      pinId: "pin2",
      pinIds: ["chip1.pin2"],
      anchor: { x: 0, y: 1 },
      center: { x: 0, y: 1 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
      orientation: "right",
    } as any,
  ]

  const result = groupLabelsByChipAndOrientation({ labels, chips: [] })

  expect(result["chip1-left"]).toHaveLength(1)
  expect(result["chip1-right"]).toHaveLength(1)
})
