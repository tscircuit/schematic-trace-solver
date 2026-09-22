import { expect, test } from "bun:test"
import {
  NetLabelNetLabelCollisionSolver,
  type NetLabelNetLabelCollisionSolverParams,
} from "lib/solvers/NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import input from "./assets/rp2040-vreg-in-label-collision.json"
import "tests/fixtures/matcher"

const createSolver = () =>
  new NetLabelNetLabelCollisionSolver(
    structuredClone(input) as unknown as NetLabelNetLabelCollisionSolverParams,
  )

// Captured at the collision-stage boundary from schematic-trace-solver 0.0.197,
// then reduced to U1's right-hand supply/USB/QSPI pins and C_CORE. There is no
// motor driver, USB connector, encoder, or unrelated schematic sheet here.
// Current full-pipeline routing avoids this input; replaying the stage guards
// against flipping the upward-only rail and leaving its connector stub behind.
test("keeps the isolated VREG_IN power label upward and attached", () => {
  const solver = createSolver()
  const before = solver.netLabelPlacements.find(
    (label) => label.netId === "V3V3",
  )!
  expect(before.orientation).toBe("y+")
  expect(input.inputProblem.availableNetLabelOrientations.V3V3).toEqual(["y+"])
  solver.solve()
  expect(solver.solved).toBe(true)
  const after = solver
    .getOutput()
    .netLabelPlacements.find((label) => label.netId === "V3V3")!
  expect(after.orientation).toBe("y+")
  expect(after.anchorPoint).toEqual(before.anchorPoint)
  const connector = solver.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-0-V3V3",
  )!
  expect(connector.tracePath.at(-1)!.x).toBeCloseTo(0.571)
  expect(after.anchorPoint.x).toBeCloseTo(connector.tracePath.at(-1)!.x)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("VREG_IN's power label must retain its allowed upward orientation", () => {
  const solver = createSolver()
  solver.solve()
  const label = solver
    .getOutput()
    .netLabelPlacements.find((label) => label.netId === "V3V3")!
  expect(input.inputProblem.availableNetLabelOrientations.V3V3).toContain(
    label.orientation,
  )
})

// Exercise the shared candidate search directly as well as the full solve.
// With no policy the old downward candidate remains available; a restricted
// policy must exclude it without removing other permitted directions.
test("nearby collision placements respect orientation subsets", () => {
  const solver = createSolver()
  const label = solver.netLabelPlacements.find(
    (label) => label.netId === "V3V3",
  )!
  const policy = solver.inputProblem.availableNetLabelOrientations
  delete policy.V3V3
  const unrestricted = solver.getNearbyValidPlacements(label, 10)
  expect(unrestricted.some((candidate) => candidate.orientation === "y-")).toBe(
    true,
  )
  policy.V3V3 = ["y+"]
  const upward = solver.getNearbyValidPlacements(label, 10)
  expect(upward).toEqual(
    unrestricted.filter((candidate) => candidate.orientation === "y+"),
  )
  policy.V3V3 = ["y+", "y-"]
  expect(solver.getNearbyValidPlacements(label, 10)).toEqual(unrestricted)
})

test("explicit connector IDs also preserve the upward rail attachment", () => {
  const params = structuredClone(
    input,
  ) as unknown as NetLabelNetLabelCollisionSolverParams
  params.netLabelConnectorTraceIds = new Set([
    "available-net-orientation-0-V3V3",
  ])
  const solver = new NetLabelNetLabelCollisionSolver(params)
  const before = solver.netLabelPlacements.find(
    (label) => label.netId === "V3V3",
  )!
  solver.solve()
  const after = solver
    .getOutput()
    .netLabelPlacements.find((label) => label.netId === "V3V3")!
  expect(after.orientation).toBe("y+")
  expect(after.anchorPoint).toEqual(before.anchorPoint)
})
