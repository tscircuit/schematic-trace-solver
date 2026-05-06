import { SchematicTracePipelineSolver } from "./lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "./lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 2,
      pins: [
        { pinId: "U1.1", x: 1, y: 0.1 },
        { pinId: "U1.2", x: 1, y: 0.05 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 1, y: 5.05 },
      width: 2,
      height: 2,
      pins: [
        { pinId: "U2.1", x: 1, y: 4.05 },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.2", "U2.1"],
      netId: "VCC",
    },
  ],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1"],
    },
  ],
  availableNetLabelOrientations: {
    GND: ["x+"],
    VCC: ["x+"],
  },
  maxMspPairDistance: 100,
}

const solver = new SchematicTracePipelineSolver(inputProblem)
solver.solve()
const labels = solver.netLabelPlacementSolver!.netLabelPlacements

console.log(`Labels: ${JSON.stringify(labels.map(l => ({ netId: l.netId, center: l.center, width: l.width, height: l.height })))}`)
