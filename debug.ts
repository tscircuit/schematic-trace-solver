import { SchematicTracePipelineSolver } from "./lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "./lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [{ chipId: "U3", center: { x: 0, y: 0 }, width: 2.8, height: 1.4, pins: [{ pinId: "U3.3", x: 1.4, y: -0.3 }, { pinId: "U3.7", x: 1.4, y: -0.5 }] }],
  directConnections: [],
  netConnections: [{ netId: "V3_3", pinIds: ["U3.3", "U3.7"], netLabelWidth: 0.42, netLabelHeight: 0.6 }],
  textBoxes: [],
  availableNetLabelOrientations: { V3_3: ["y+"] },
  maxMspPairDistance: 2.4,
}

const solver = new SchematicTracePipelineSolver(inputProblem) as any
solver.solve()
console.log("solved", solver.solved, "failed", solver.failed)
for (const def of solver.pipelineDef) {
  const inst = solver[def.solverName]
  if (!inst) console.log(def.solverName, "NOT CREATED")
  else console.log(def.solverName, "solved:", inst.solved, "failed:", inst.failed, "err:", inst.error?.message || inst.error || "")
}
