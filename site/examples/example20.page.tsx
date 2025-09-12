import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 2.4000000000000004,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: 1.2000000000000002,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -1.2000000000000002,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.3",
          x: 1.2000000000000002,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -1.2000000000000002,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: -1.2000000000000002,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.6",
          x: -1.2000000000000002,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.7",
          x: 1.2000000000000002,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.8",
          x: 1.2000000000000002,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 2.7,
        y: 1.9049999999999998,
      },
      width: 2.2,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 1.6,
          y: 2.105,
        },
        {
          pinId: "J1.2",
          x: 1.6,
          y: 1.9049999999999998,
        },
        {
          pinId: "J1.3",
          x: 1.6,
          y: 1.7049999999999998,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "J1.3"],
    },
    {
      netId: "VCC",
      pinIds: ["U1.8", "J1.1"],
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    OUT: ["x-", "x+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
