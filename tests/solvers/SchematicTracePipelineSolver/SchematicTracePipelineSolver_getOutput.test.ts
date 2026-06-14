import type { InputProblem } from "lib/types/InputProblem"
import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/index"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U1.1",
          x: -0.8,
          y: 0.2,
        },
        {
          pinId: "U1.2",
          x: -0.8,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: -0.8,
          y: -0.2,
        },
        {
          pinId: "U1.4",
          x: 0.8,
          y: -0.2,
        },
        {
          pinId: "U1.5",
          x: 0.8,
          y: 0,
        },
        {
          pinId: "U1.6",
          x: 0.8,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C1.1",
          x: -2,
          y: 0.5,
        },
        {
          pinId: "C1.2",
          x: -2,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "C2",
      center: { x: -4, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C2.1",
          x: -4,
          y: 0.5,
        },
        {
          pinId: "C2.2",
          x: -4,
          y: -0.5,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.2", "C2.1"],
      netId: "EN",
    },
  ],
  netConnections: [
    {
      pinIds: ["U1.3", "C2.2", "C1.2"],
      netId: "GND",
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    EN: ["x+", "x-"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2,
}

test("SchematicTracePipelineSolver.getOutput() returns traces and netLabelPlacements", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  expect(solver.solved).toBe(true)

  const output = solver.getOutput()

  // Should have the output shape
  expect(output).toHaveProperty("traces")
  expect(output).toHaveProperty("netLabelPlacements")

  // traces should be an array of SolvedTracePath
  expect(Array.isArray(output.traces)).toBe(true)
  expect(output.traces.length).toBeGreaterThan(0)

  // Each trace should have the expected properties
  for (const trace of output.traces) {
    expect(trace).toHaveProperty("tracePath")
    expect(trace).toHaveProperty("mspPairId")
    expect(Array.isArray(trace.tracePath)).toBe(true)
    expect(trace.tracePath.length).toBeGreaterThanOrEqual(2)
  }

  // netLabelPlacements should be an array of NetLabelPlacement
  expect(Array.isArray(output.netLabelPlacements)).toBe(true)
  expect(output.netLabelPlacements.length).toBeGreaterThan(0)

  // Each placement should have the expected properties
  for (const placement of output.netLabelPlacements) {
    expect(placement).toHaveProperty("globalConnNetId")
    expect(placement).toHaveProperty("orientation")
    expect(placement).toHaveProperty("anchorPoint")
    expect(placement).toHaveProperty("center")
    expect(placement).toHaveProperty("width")
    expect(placement).toHaveProperty("height")
    expect(typeof placement.width).toBe("number")
    expect(typeof placement.height).toBe("number")
    expect(placement.center).toHaveProperty("x")
    expect(placement.center).toHaveProperty("y")
  }
})

test("SchematicTracePipelineSolver.getOutput() matches final sub-solver outputs", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  solver.solve()

  const output = solver.getOutput()

  // Traces should match the netLabelTraceCollisionSolver output
  if (solver.netLabelTraceCollisionSolver) {
    const directTraces = solver.netLabelTraceCollisionSolver.getOutput().traces
    expect(output.traces).toEqual(directTraces)
  }

  // Net label placements should match the netLabelNetLabelCollisionSolver output
  if (solver.netLabelNetLabelCollisionSolver) {
    const directPlacements =
      solver.netLabelNetLabelCollisionSolver.getOutput().netLabelPlacements
    expect(output.netLabelPlacements).toEqual(directPlacements)
  }
})
