import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

// This example demonstrates the merge collinear traces feature (issue #34)
// It creates a scenario where multiple horizontal trace segments should be
// merged into single continuous lines
export const inputProblem: InputProblem = {
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
          x: 0.8,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2.5, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C1.1",
          x: -2.5,
          y: 0.5,
        },
        {
          pinId: "C1.2",
          x: -2.5,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "C2",
      center: { x: 2.5, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "C2.1",
          x: 2.5,
          y: 0.5,
        },
        {
          pinId: "C2.2",
          x: 2.5,
          y: -0.5,
        },
      ],
    },
    {
      chipId: "R1",
      center: { x: -4, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        {
          pinId: "R1.1",
          x: -4,
          y: 0.5,
        },
        {
          pinId: "R1.2",
          x: -4,
          y: -0.5,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["R1.1", "C1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["C1.1", "U1.1"],
      netId: "VCC",
    },
    {
      pinIds: ["U1.2", "C2.1"],
      netId: "OUT",
    },
  ],
  netConnections: [
    {
      pinIds: ["R1.2", "C1.2", "C2.2"],
      netId: "GND",
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
