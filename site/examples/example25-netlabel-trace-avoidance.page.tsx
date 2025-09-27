import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
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
    // VCC connection - should create a trace that blocks netlabel placement
    {
      pinIds: ["U1.VCC", "C1.1"],
      netId: "VCC", 
    },
    // GND connection
    {
      pinIds: ["U1.GND", "C1.2"],
      netId: "GND",
    },
    // Output connection with intentional routing conflict
    {
      pinIds: ["U1.OUT", "R1.1"],
      netId: "OUTPUT",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {
    "VCC": ["y+", "y-"], // Force specific orientations that might conflict
    "GND": ["y+", "y-"],
    "OUTPUT": ["x+", "x-"],
  },
}

export default () => {
  return (
    <div>
      <h1>NetLabel Trace Overlap Avoidance Example</h1>
      <p>
        This example creates a scenario where netlabels (VCC, GND, OUTPUT) might conflict with trace routing.
        The new NetlabelTraceOverlapAvoidanceSolver should modify trace paths to create space for netlabels
        that cannot be placed due to collisions.
      </p>
      <PipelineDebugger inputProblem={inputProblem} />
    </div>
  )
}