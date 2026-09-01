import { expect, test } from "bun:test"
import { NetLabelNetLabelCollisionSolver } from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"

const label = (globalConnNetId: string, pinIds: string[]) =>
  ({
    globalConnNetId,
    pinIds,
    mspConnectionPairIds: [],
    orientation: "x+",
    center: { x: 0, y: 0 },
    width: 1,
    height: 1,
  }) as unknown as NetLabelPlacement

const collisionKey = (a: NetLabelPlacement, b: NetLabelPlacement) =>
  (
    NetLabelNetLabelCollisionSolver.prototype as unknown as {
      collisionKey: (a: NetLabelPlacement, b: NetLabelPlacement) => string
    }
  ).collisionKey(a, b)

test("distinct label pairs on the same nets get distinct collision keys", () => {
  // Two separate pairs of labels, both drawn from netA and netB. Keying on the
  // net ids alone would collapse them into one key, so abandoning the search
  // for the first pair would silently suppress the second — on the larger
  // boards a single net pair covers over a hundred label pairs.
  const first = collisionKey(label("netA", ["p1"]), label("netB", ["p2"]))
  const second = collisionKey(label("netA", ["p3"]), label("netB", ["p4"]))

  expect(first).not.toBe(second)
})

test("collision key is stable regardless of argument order", () => {
  const a = label("netA", ["p1"])
  const b = label("netB", ["p2"])

  expect(collisionKey(a, b)).toBe(collisionKey(b, a))
})

test("collision key is stable regardless of pin id order", () => {
  const a = label("netA", ["p1", "p2"])
  const b = label("netA", ["p2", "p1"])
  const other = label("netB", ["p3"])

  expect(collisionKey(a, other)).toBe(collisionKey(b, other))
})
