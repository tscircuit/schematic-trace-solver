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

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
