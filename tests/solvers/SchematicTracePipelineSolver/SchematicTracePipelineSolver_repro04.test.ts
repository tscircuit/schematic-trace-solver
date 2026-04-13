import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "J2",
      center: { x: 0, y: 0 },
      width: 0.65,
      height: 1.8,
      pins: [
        { pinId: "J2.1", x: 0.325, y: 0.8 },
        { pinId: "J2.2", x: 0.325, y: 0.6 },
        { pinId: "J2.3", x: 0.325, y: 0.4 },
        { pinId: "J2.4", x: 0.325, y: 0.2 },
        { pinId: "J2.5", x: 0.325, y: 0 },
        { pinId: "J2.6", x: 0.325, y: -0.2 },
        { pinId: "J2.7", x: 0.325, y: -0.4 },
        { pinId: "J2.8", x: 0.325, y: -0.6 },
        { pinId: "J2.9", x: 0.325, y: -0.8 },
      ],
    },
    {
      chipId: "U1",
      center: { x: 4, y: 0.4 },
      width: 1,
      height: 2,
      pins: [
        { pinId: "U1.1", x: 3.5, y: 1.2 },
        { pinId: "U1.2", x: 3.5, y: 0.8 },
        { pinId: "U1.3", x: 3.5, y: 0.4 },
        { pinId: "U1.4", x: 3.5, y: 0 },
        { pinId: "U1.5", x: 3.5, y: -0.4 },
        { pinId: "U1.6", x: 4.5, y: 1 },
        { pinId: "U1.7", x: 4.5, y: 0.6 },
        { pinId: "U1.8", x: 4.5, y: 0.2 },
        { pinId: "U1.9", x: 4.5, y: -0.2 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["J2.1", "U1.1"], netId: "J2.pin1 to U1.pin1" },
    { pinIds: ["J2.2", "U1.2"], netId: "J2.pin2 to U1.pin2" },
    { pinIds: ["J2.3", "U1.3"], netId: "J2.pin3 to U1.pin3" },
    { pinIds: ["J2.4", "U1.4"], netId: "J2.pin4 to U1.pin4" },
    { pinIds: ["J2.5", "U1.5"], netId: "J2.pin5 to U1.pin5" },
    { pinIds: ["J2.6", "U1.6"], netId: "J2.pin6 to U1.pin6" },
    { pinIds: ["J2.7", "U1.7"], netId: "J2.pin7 to U1.pin7" },
    { pinIds: ["J2.8", "U1.8"], netId: "J2.pin8 to U1.pin8" },
    { pinIds: ["J2.9", "U1.9"], netId: "J2.pin9 to U1.pin9" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

test.skip("SchematicTracePipelineSolver_repro04", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)

  solver.solve()

  expect(solver.solved).toBe(true)
})
