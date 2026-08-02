import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "PWR1",
      center: { x: 0, y: 0 },
      width: 2.1,
      height: 1,
      pins: [
        { pinId: "PWR1.EP", x: 1.05, y: 0.2 },
        { pinId: "PWR1.GND", x: -1.05, y: -0.1 },
      ],
    },
    {
      chipId: "R7",
      center: { x: -3, y: -2 },
      width: 0.6,
      height: 0.68,
      pins: [{ pinId: "R7.2", x: -2.7, y: -2, _facingDirection: "x+" }],
    },
    {
      chipId: "C6",
      center: { x: 3, y: -1.5 },
      width: 0.6,
      height: 0.84,
      pins: [{ pinId: "C6.neg", x: 3.3, y: -1.5, _facingDirection: "x+" }],
    },
    {
      chipId: "C7",
      center: { x: 3, y: 0 },
      width: 0.6,
      height: 0.84,
      pins: [{ pinId: "C7.neg", x: 3.3, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "LED1",
      center: { x: 4, y: 3.1325 },
      width: 1.13,
      height: 0.915,
      pins: [
        {
          pinId: "LED1.neg",
          x: 4.565,
          y: 3,
          _facingDirection: "x+",
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "gnd",
      pinIds: ["PWR1.EP", "PWR1.GND", "R7.2", "C6.neg", "C7.neg", "LED1.neg"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
    },
  ],
  textBoxes: [],
  availableNetLabelOrientations: { gnd: ["y-"] },
  maxMspPairDistance: 2.4,
}

test("places a shared capacitor GND label at the lower rail end", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const gndLabels = solver
    .netLabelNetLabelCollisionSolver!.getOutput()
    .netLabelPlacements.filter((label) => label.netId === "gnd")
  const capacitorRailLabel = gndLabels.find(
    (label) => Math.abs(label.anchorPoint.x - 3.3) < 1,
  )!

  expect(capacitorRailLabel.orientation).toBe("y-")
  expect(capacitorRailLabel.anchorPoint.y).toBeCloseTo(-1.5)
  expect(capacitorRailLabel.anchorPoint.x).toBeGreaterThan(3.3)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
