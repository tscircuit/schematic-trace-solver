import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    { chipId: "U0", center: { x: 0, y: -0.5 }, width: 0.4, height: 1 },
    { chipId: "U1", center: { x: 1, y: -0.5 }, width: 0.4, height: 1 },
    { chipId: "U2", center: { x: 4, y: -0.3 }, width: 0.4, height: 1 },
    { chipId: "U3", center: { x: 5, y: -0.3 }, width: 0.4, height: 1 },
  ].map((chip, index) => ({
    ...chip,
    pins: [
      {
        pinId: `P${index}`,
        x: chip.center.x,
        y: chip.center.y + chip.height / 2,
        _facingDirection: "y+" as const,
      },
    ],
  })),
  directConnections: [],
  netConnections: [
    {
      netId: "SIGNAL",
      pinIds: ["P0", "P1", "P2", "P3"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.4,
    },
  ],
  availableNetLabelOrientations: { SIGNAL: ["y+"] },
  maxMspPairDistance: 1.1,
}

test("joins aligned routed components in a multi-pin named net", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem, {
    hideRatsNet: true,
  })

  solver.solve()

  const output = solver.netLabelToTraceSolver!.getOutput()
  expect(
    output.traces.some(
      (trace) => trace.pinIds.includes("P1") && trace.pinIds.includes("P2"),
    ),
  ).toBe(true)
  expect(output.netLabelPlacements).toHaveLength(2)
})
