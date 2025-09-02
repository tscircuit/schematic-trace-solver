import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0.43333333333333357,
        y: 0.4844553499999995,
      },
      width: 1.6,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: 1.6333333333333337,
          y: 0.18445534999999946,
        },
        {
          pinId: "U1.2",
          x: -0.7666666666666666,
          y: 0.18445534999999946,
        },
        {
          pinId: "U1.3",
          x: 1.6333333333333337,
          y: 0.5844553499999995,
        },
        {
          pinId: "U1.4",
          x: -0.7666666666666666,
          y: 0.7844553499999996,
        },
        {
          pinId: "U1.5",
          x: -0.7666666666666666,
          y: 0.5844553499999996,
        },
        {
          pinId: "U1.6",
          x: -0.7666666666666666,
          y: 0.38445534999999953,
        },
        {
          pinId: "U1.7",
          x: 1.6333333333333337,
          y: 0.3844553499999995,
        },
        {
          pinId: "U1.8",
          x: 1.6333333333333337,
          y: 0.7844553499999996,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 2.016666666666667,
        y: -0.8099999999999996,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 2.5666666666666673,
          y: -0.8099999999999997,
        },
        {
          pinId: "R1.2",
          x: 1.4666666666666668,
          y: -0.8099999999999995,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 0.21666666666666679,
        y: -0.81,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R2.1",
          x: 0.7666666666666668,
          y: -0.8100000000000002,
        },
        {
          pinId: "R2.2",
          x: -0.33333333333333326,
          y: -0.8099999999999999,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -0.9266666666666671,
        y: 2.6244553499999994,
      },
      width: 1.06,
      height: 0.84,
      pins: [
        {
          pinId: "C1.1",
          x: -1.476666666666667,
          y: 2.6244553499999994,
        },
        {
          pinId: "C1.2",
          x: -0.37666666666666704,
          y: 2.6244553499999994,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: -2.0166666666666666,
        y: 0.5844553499999996,
      },
      width: 1.06,
      height: 0.84,
      pins: [
        {
          pinId: "C2.1",
          x: -1.4666666666666668,
          y: 0.5844553499999995,
        },
        {
          pinId: "C2.2",
          x: -2.5666666666666664,
          y: 0.5844553499999997,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 1.9333333333333327,
        y: 2.6044553499999994,
      },
      width: 1.4000000000000001,
      height: 0.8,
      pins: [
        {
          pinId: "J1.1",
          x: 0.8333333333333326,
          y: 2.8044553499999996,
        },
        {
          pinId: "J1.2",
          x: 0.8333333333333326,
          y: 2.6044553499999994,
        },
        {
          pinId: "J1.3",
          x: 0.8333333333333326,
          y: 2.404455349999999,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.5", "C2.1"],
      netId: "U1.CTRL to C2.pin1",
    },
    {
      pinIds: ["R1.2", "U1.7"],
      netId: "R1.pin2 to U1.DISCH",
    },
    {
      pinIds: ["U1.7", "R2.1"],
      netId: "U1.DISCH to R2.pin1",
    },
  ],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "C1.2", "C2.2", "J1.3"],
    },
    {
      netId: "NODE",
      pinIds: ["U1.2", "U1.6", "R2.2", "C1.1"],
    },
    {
      netId: "OUT",
      pinIds: ["U1.3", "J1.2"],
    },
    {
      netId: "VCC",
      pinIds: ["U1.4", "U1.8", "R1.1", "J1.1"],
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
