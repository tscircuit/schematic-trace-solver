import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "../lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "../lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -5, y: 0 },
      width: 2,
      height: 4,
      pins: [
        { pinId: "U1.1", x: -4, y: 1 },
        { pinId: "U1.2", x: -4, y: -1 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 5, y: 0 },
      width: 2,
      height: 4,
      pins: [
        { pinId: "U2.1", x: 4, y: 1 },
        { pinId: "U2.2", x: 4, y: -1 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "U2.1"], netId: "net1" },
    { pinIds: ["U1.2", "U2.2"], netId: "net1" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 100,
}

test("repro_issue_34_parallel_traces", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()
  const traces = solver.traceCleanupSolver!.getOutput().traces
  
  console.log(`Number of traces: ${traces.length}`)
  for (const trace of traces) {
    console.log(`Trace ${trace.mspPairId}: ${JSON.stringify(trace.tracePath)}`)
  }

  // If they are not merged, we will have 2 traces.
  // The goal is to have them merged or at least sharing segments if they are close.
  // However, the issue specifically says "Merge same-net trace lines that are close together (make at the same Y or same X)"
})
