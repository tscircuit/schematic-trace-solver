import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

// Reduced from the current @tscircuit/core input for an RP2040. The important
// details are the 0.2-unit pin pitch, V3V3's 0.6-unit rail-label height, and a
// third distance-split net member. The reversed first pair preserves the MSP
// pair direction produced by the original multi-pin input (pin 10 to pin 1).
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.9,
      height: 6,
      pins: Array.from({ length: 22 }, (_, index) => ({
        pinId: `U1.${index + 1}`,
        x: -1.35,
        y: 2.8 - index * 0.2,
        _facingDirection: "x-" as const,
      })),
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "V3V3",
      pinIds: ["U1.10", "U1.1", "U1.22"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.6,
    },
  ],
  textBoxes: [
    {
      chipId: "U1",
      center: { x: -0.83, y: 3.115 },
      width: 0.36,
      height: 0.25,
      text: "U1",
    },
  ],
  availableNetLabelOrientations: { V3V3: ["y+"] },
  maxMspPairDistance: 2.4,
}

test("places the RP2040 V3V3 label by the top pin", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const v3v3Label = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.find(
      (label) => label.netId === "V3V3" && label.pinIds.includes("U1.1"),
    )

  expect(v3v3Label?.orientation).toBe("y+")
  expect(v3v3Label?.anchorPoint.y).toBeCloseTo(2.8)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
