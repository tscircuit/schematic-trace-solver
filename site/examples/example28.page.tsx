import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "1",
      center: {
        x: 0,
        y: 0,
      },
      width: 0.6,
      height: 0.4,
      pins: [
        {
          pinId: "IN",
          x: -0.3,
          y: 0.1,
        },
        {
          pinId: "GND",
          x: -0.3,
          y: 0,
        },
        {
          pinId: "EN",
          x: -0.3,
          y: -0.1,
        },
        {
          pinId: "OUT",
          x: 0.3,
          y: 0.1,
        },
        {
          pinId: "NC",
          x: 0.3,
          y: 0,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "V5_IN",
      pinIds: ["IN", "EN"],
    },
    {
      netId: "V3P3",
      pinIds: ["OUT"],
    },
    {
      netId: "GND",
      pinIds: ["GND"],
    },
  ],
  availableNetLabelOrientations: {},
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
