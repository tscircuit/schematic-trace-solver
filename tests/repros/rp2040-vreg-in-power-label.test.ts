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
// Current full-pipeline routing avoids this input, but this stage still flips
// the upward-only V3V3 rail and leaves its pre-existing connector stub behind.
test("reproduces the isolated VREG_IN power label moving off its stub", () => {
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
  expect(after.orientation).toBe("y-")
  expect(after.anchorPoint.x).toBeCloseTo(-0.5863333333333337)
  const connector = solver.traces.find(
    (trace) => trace.mspPairId === "available-net-orientation-0-V3V3",
  )!
  expect(connector.tracePath.at(-1)!.x).toBeCloseTo(0.571)
  expect(after.anchorPoint.x).not.toBeCloseTo(connector.tracePath.at(-1)!.x)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test.failing("VREG_IN's power label must retain its allowed upward orientation", () => {
  const solver = createSolver()
  solver.solve()
  const label = solver
    .getOutput()
    .netLabelPlacements.find((label) => label.netId === "V3V3")!
  expect(input.inputProblem.availableNetLabelOrientations.V3V3).toContain(
    label.orientation,
  )
})
