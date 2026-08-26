import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "R2",
      center: { x: -4.5, y: 0 },
      width: 1,
      height: 0.5,
      pins: [{ pinId: "R2.1", x: -4, y: 0, _facingDirection: "x+" }],
    },
    {
      chipId: "R1",
      center: { x: -4.5, y: 1 },
      width: 1,
      height: 0.5,
      pins: [{ pinId: "R1.1", x: -4, y: 1, _facingDirection: "x+" }],
    },
    {
      chipId: "U1",
      center: { x: 0.5, y: 1 },
      width: 1,
      height: 0.5,
      pins: [{ pinId: "U1.EN", x: 0, y: 1, _facingDirection: "x-" }],
    },
  ],
  directConnections: [
    {
      netId: "ENABLE_NET",
      pinIds: ["R2.1", "R1.1"],
    },
    {
      netId: "ENABLE_NET",
      netLabelText: "U1_EN",
      pinIds: ["R2.1", "U1.EN"],
      allowInlineNetLabel: true,
      inlineNetLabelWidth: 0.48,
      inlineNetLabelHeight: 0.12,
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 100,
}

test("branched connection whose source pair is replaced by the MSP", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.inlineNetLabelSolver!.getOutput()
  const exactSourcePairTrace = output.traces.find((trace) =>
    trace.pins.every((pin) => ["R2.1", "U1.EN"].includes(pin.pinId)),
  )
  expect(exactSourcePairTrace).toBeUndefined()
  expect(output.inlineNetLabelPlacements).toHaveLength(1)

  const [inlineNetLabelPlacement] = output.inlineNetLabelPlacements
  expect(inlineNetLabelPlacement).toMatchObject({
    netLabelText: "U1_EN",
    mspPairId: "U1.EN-R1.1",
    axis: "x",
  })
  expect(inlineNetLabelPlacement!.anchorPoint.x).toBeCloseTo(-2)
  expect(inlineNetLabelPlacement!.anchorPoint.y).toBeCloseTo(1)

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})

test("places an inline label when netId provides the display text", () => {
  const inputProblemWithoutNetLabelText = structuredClone(inputProblem)
  delete inputProblemWithoutNetLabelText.directConnections[1]!.netLabelText
  const solver = new SchematicTracePipelineSolver(
    inputProblemWithoutNetLabelText,
  )

  solver.solve()

  const [inlineNetLabelPlacement] =
    solver.inlineNetLabelSolver!.getOutput().inlineNetLabelPlacements
  expect(inlineNetLabelPlacement).toMatchObject({
    netId: "ENABLE_NET",
    mspPairId: "U1.EN-R1.1",
    axis: "x",
  })
  expect(inlineNetLabelPlacement!.anchorPoint.x).toBeCloseTo(-2)
  expect(inlineNetLabelPlacement!.anchorPoint.y).toBeCloseTo(1)
})
