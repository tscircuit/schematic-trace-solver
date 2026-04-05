import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "JP6",
      center: { x: 0, y: 0 },
      width: 1,
      height: 0.6,
      pins: [
        { pinId: "JP6.1", x: 0.5, y: -0.1 },
        { pinId: "JP6.2", x: 0.5, y: 0.1 },
      ],
    },
    {
      chipId: "R1",
      center: { x: 4, y: 0 },
      width: 0.4,
      height: 1,
      pins: [
        { pinId: "R1.1", x: 4, y: -0.4 },
        { pinId: "R1.2", x: 4, y: 0.4 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["JP6.1", "JP6.2", "R1.1"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
