import { PipelineDebugger } from "../components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 0.8935117710000002,
      height: 1.1601665819999987,
      pins: [
        {
          pinId: "Q1.1",
          x: 0.30397715550000004,
          y: 0.5519248499999994,
        },
        {
          pinId: "Q1.2",
          x: 0.31067575550000137,
          y: -0.5519248499999994,
        },
        {
          pinId: "Q1.3",
          x: -0.41859744450000014,
          y: -0.10250625000000019,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "V3_3",
      pinIds: ["Q1.1", "Q1.2"],
    },
  ],
  availableNetLabelOrientations: {
    V3_3: ["y+"],
  },
  maxMspPairDistance: 2,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
