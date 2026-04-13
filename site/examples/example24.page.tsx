import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -3,
        y: 0,
      },
      width: 2.4000000000000004,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: -1.8,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -4.2,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.3",
          x: -1.8,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -4.2,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: -4.2,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.6",
          x: -4.2,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.7",
          x: -1.8,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.8",
          x: -1.8,
          y: 0.30000000000000004,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 3,
        y: 0,
      },
      width: 2.2,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 1.9,
          y: 0.2,
        },
        {
          pinId: "J1.2",
          x: 1.9,
          y: 0,
        },
        {
          pinId: "J1.3",
          x: 1.9,
          y: -0.2,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 0,
        y: 1, // Moved down so component body doesn't block horizontal traces
      },
      width: 1,
      height: 1,
      pins: [
        {
          pinId: "U2.3",
          x: -0.4,
          y: 0.5, // Bottom pin
        },
        {
          pinId: "U2.4",
          x: 0.4,
          y: 0.5,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "SIGNAL1",
      pinIds: ["U2.3"],
    },
    {
      netId: "SIGNAL2",
      pinIds: ["U2.4"],
    },
    {
      netId: "SSH",
      pinIds: ["U1.1", "J1.3"],
    },
    {
      netId: "BHH",
      pinIds: ["J1.1", "U1.3"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 6.5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
