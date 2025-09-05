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
        x: 2.45,
        y: -0.10000000000000009,
      },
      width: 1.0999999999999996,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 3,
          y: -0.10000000000000016,
        },
        {
          pinId: "R1.2",
          x: 1.9000000000000004,
          y: -0.10000000000000002,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 0.6500000000000001,
        y: -1.2944553500000002,
      },
      width: 1.1,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R2.1",
          x: 1.2000000000000002,
          y: -1.2944553500000002,
        },
        {
          pinId: "R2.2",
          x: 0.10000000000000009,
          y: -1.2944553500000002,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -1.2000000000000002,
        y: -1.7000000000000002,
      },
      width: 1.06,
      height: 1.1,
      pins: [
        {
          pinId: "C1.1",
          x: -1.2000000000000002,
          y: -1.1500000000000001,
        },
        {
          pinId: "C1.2",
          x: -1.2000000000000002,
          y: -2.25,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: -2.45,
        y: 0.10000000000000009,
      },
      width: 1.0999999999999996,
      height: 0.84,
      pins: [
        {
          pinId: "C2.1",
          x: -1.9000000000000004,
          y: 0.10000000000000002,
        },
        {
          pinId: "C2.2",
          x: -3,
          y: 0.10000000000000016,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 1.2000000000000002,
        y: 1.7000000000000002,
      },
      width: 1.06,
      height: 1.1,
      pins: [
        {
          pinId: "R3.1",
          x: 1.2000000000000002,
          y: 1.1500000000000001,
        },
        {
          pinId: "R3.2",
          x: 1.2000000000000002,
          y: 2.25,
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
      pinIds: ["U1.6", "U1.2"],
      netId: "U1.THRES to U1.TRIG",
    },
    {
      pinIds: ["R1.2", "U1.7"],
      netId: "R1.pin2 to U1.DISCH",
    },
    {
      pinIds: ["U1.7", "R2.1"],
      netId: "U1.DISCH to R2.pin1",
    },
    {
      pinIds: ["R2.2", "U1.6"],
      netId: "R2.pin2 to U1.THRES",
    },
    {
      pinIds: ["U1.6", "C1.1"],
      netId: "U1.THRES to C1.pin1",
    },
    {
      pinIds: ["U1.3", "R3.1"],
      netId: "U1.OUT to R3.pin1",
    },
  ],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U1.1", "C1.2", "C2.2"],
    },
    {
      netId: "VCC",
      pinIds: ["U1.4", "U1.8", "R1.1"],
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
