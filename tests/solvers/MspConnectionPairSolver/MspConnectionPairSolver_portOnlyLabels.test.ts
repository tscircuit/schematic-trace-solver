import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 2, y: -0.5 },
        { pinId: "C1.2", x: 2, y: 0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 0, y: -0.5 },
        { pinId: "C2.2", x: 0, y: 0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1"] },
    { netId: "VCC", pinIds: ["C1.2"] },
    { netId: "GND", pinIds: ["C2.1"] },
    { netId: "VCC", pinIds: ["C2.2"] },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
}

test("keeps repeated single-pin net labels as labels instead of routing traces between them", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  const output = solver.netLabelTraceCollisionSolver!.getOutput()
  expect(output.traces).toEqual([])
  expect(output.netLabelPlacements).toHaveLength(4)
})
