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
      width: 1.4000000000000001,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 1.1,
          y: 0.2,
        },
        {
          pinId: "J1.2",
          x: 1.1,
          y: 0,
        },
        {
          pinId: "J1.3",
          x: 1.1,
          y: -0.2,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 1.0999999999999996,
        y: -1.7944553499999996,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 0.5499999999999996,
          y: -1.7944553499999996,
        },
        {
          pinId: "R1.2",
          x: 1.6499999999999997,
          y: -1.7944553499999996,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 2.86,
        y: 0.01999999999999985,
      },
      width: 1.06,
      height: 0.84,
      pins: [
        {
          pinId: "C1.1",
          x: 2.3099999999999996,
          y: 0.01999999999999985,
        },
        {
          pinId: "C1.2",
          x: 3.41,
          y: 0.01999999999999985,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VCC",
      pinIds: ["J1.1", "C1.1"],
    },
    {
      netId: "OUT",
      pinIds: ["J1.2", "R1.1"],
    },
    {
      netId: "GND",
      pinIds: ["J1.3", "R1.2", "C1.2"],
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
