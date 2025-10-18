import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.6,
      height: 1.2,
      pins: [
        {
          pinId: "C1.1",
          x: 2,
          y: 0.6,
        },
        {
          pinId: "C1.2",
          x: 2,
          y: -0.6,
        },
      ],
    },
    {
      chipId: "C2",
      center: { x: -1, y: 0 },
      width: 0.6,
      height: 1.2,
      pins: [
        {
          pinId: "C2.1",
          x: -1,
          y: 0.6,
        },
        {
          pinId: "C2.2",
          x: -1,
          y: -0.6,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      pinIds: ["C1.1", "C2.1"],
      netId: "VCC",
    },
    {
      pinIds: ["C1.2", "C2.2"],
      netId: "GND",
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />