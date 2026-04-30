import { test, expect } from "bun:test"
import { mergeLabelGroup } from "lib/solvers/TraceLabelOverlapAvoidanceSolver/sub-solvers/LabelMergingSolver/mergeLabelGroup"

test("mergeLabelGroup throws for empty group", () => {
  expect(() => mergeLabelGroup([], "chip1-left")).toThrow()
})

test("mergeLabelGroup merges two labels", () => {
  const group = [
    {
      netId: "net1",
      globalConnNetId: "global-1",
      chipId: "chip1",
      pinId: "pin1",
      pinIds: ["chip1.pin1"],
      mspConnectionPairIds: ["pair1"],
      anchor: { x: 0, y: 0 },
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    },
    {
      netId: "net2",
      globalConnNetId: "global-2",
      chipId: "chip1",
      pinId: "pin2",
      pinIds: ["chip1.pin2"],
      mspConnectionPairIds: ["pair2"],
      anchor: { x: 1, y: 0 },
      center: { x: 1, y: 0 },
      width: 0.5,
      height: 0.2,
      facingDirection: "x+",
    },
  ]

  const result = mergeLabelGroup(group, "chip1-left")

  expect(result.mergedLabel).toBeDefined()
  expect(result.originalNetIds.size).toBe(2)
  expect(result.originalNetIds.has("global-1")).toBe(true)
  expect(result.originalNetIds.has("global-2")).toBe(true)
})
