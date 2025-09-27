import { test, expect } from "bun:test"
import { NetlabelTraceOverlapAvoidanceSolver } from "lib/solvers/NetlabelTraceOverlapAvoidanceSolver/NetlabelTraceOverlapAvoidanceSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1,
      pins: [
        {
          pinId: "U1.VCC",
          x: -1,
          y: 0.4,
        },
        {
          pinId: "U1.GND",
          x: -1,
          y: -0.4,
        },
        {
          pinId: "U1.OUT",
          x: 1,
          y: 0,
        },
      ],
    },
    {
      chipId: "C1", 
      center: { x: -3, y: 0 },
      width: 0.5,
      height: 0.8,
      pins: [
        {
          pinId: "C1.1",
          x: -2.75,
          y: 0.2,
        },
        {
          pinId: "C1.2", 
          x: -2.75,
          y: -0.2,
        },
      ],
    },
    {
      chipId: "R1",
      center: { x: 3, y: 0 },
      width: 1,
      height: 0.4,
      pins: [
        {
          pinId: "R1.1",
          x: 2.5,
          y: 0,
        },
        {
          pinId: "R1.2",
          x: 3.5,
          y: 0,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.VCC", "C1.1"],
      netId: "VCC", 
    },
    {
      pinIds: ["U1.GND", "C1.2"],
      netId: "GND",
    },
    {
      pinIds: ["U1.OUT", "R1.1"],
      netId: "OUTPUT",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {
    "VCC": ["y+", "y-"],
    "GND": ["y+", "y-"], 
    "OUTPUT": ["x+", "x-"],
  },
}

test("NetlabelTraceOverlapAvoidanceSolver integration test", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem)
  
  // Run the complete pipeline
  while (!solver.solved && !solver.failed) {
    solver.step()
  }
  
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
  
  // Check that we have netlabel placements (either from initial placement or from our new solver)
  const netLabelPlacements = solver.netLabelPlacementSolver?.netLabelPlacements ?? []
  expect(netLabelPlacements.length).toBeGreaterThan(0)
  
  // Check if our solver ran and potentially created successful placements
  const netlabelTraceOverlapSolver = solver.netlabelTraceOverlapAvoidanceSolver
  if (netlabelTraceOverlapSolver) {
    const { successfullyPlacedNetlabels, modifiedTraceMap } = netlabelTraceOverlapSolver.getOutput()
    
    // If it placed any netlabels, they should have valid properties
    for (const placement of successfullyPlacedNetlabels) {
      expect(placement.globalConnNetId).toBeTruthy()
      expect(placement.center).toBeTruthy()
      expect(placement.width).toBeGreaterThan(0)
      expect(placement.height).toBeGreaterThan(0)
    }
  }
  
  // Verify that the pipeline completed without errors
  expect(solver.getCurrentPhase()).toBe("none") // Pipeline completed
})

test("NetlabelTraceOverlapAvoidanceSolver should handle empty failed placements", () => {
  const solver = new NetlabelTraceOverlapAvoidanceSolver({
    inputProblem,
    inputTraceMap: {},
    failedNetlabelPlacements: []
  })
  
  // Should immediately solve with no failed placements
  solver.step()
  expect(solver.solved).toBe(true)
  
  const { successfullyPlacedNetlabels } = solver.getOutput()
  expect(successfullyPlacedNetlabels).toEqual([])
})