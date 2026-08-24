import type { InputProblem } from "lib/types/InputProblem"

export default {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -5,
        y: 1.2,
      },
      width: 3.3,
      height: 0.8000000000000002,
      pins: [
        {
          pinId: "schematic_port_0",
          x: -3.35,
          y: 1.2,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -2.33875,
        y: 1.6,
      },
      width: 0.7225000000000001,
      height: 0.20000000000000018,
      pins: [
        {
          pinId: "schematic_port_1",
          x: -2.7,
          y: 1.6,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -3.7,
        y: 0.19999999999999998,
      },
      width: 0.7400000000000002,
      height: 1.0400000000000003,
      pins: [
        {
          pinId: "schematic_port_2",
          x: -3.8,
          y: 0.7200000000000001,
        },
        {
          pinId: "schematic_port_3",
          x: -3.8,
          y: -0.3200000000000002,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -2.1,
        y: 0.19999999999999998,
      },
      width: 0.74,
      height: 1.0400000000000003,
      pins: [
        {
          pinId: "schematic_port_4",
          x: -2.2,
          y: 0.7200000000000001,
        },
        {
          pinId: "schematic_port_5",
          x: -2.2,
          y: -0.3200000000000002,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: -0.685,
        y: 0.7,
      },
      width: 1.33,
      height: 0.6000000000000001,
      pins: [
        {
          pinId: "schematic_port_6",
          x: -0.9,
          y: 1,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_7",
          x: -0.9,
          y: 0.3999999999999999,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: -0.715,
        y: -0.5,
      },
      width: 0.99,
      height: 1.08,
      pins: [
        {
          pinId: "schematic_port_8",
          x: -0.9,
          y: 0.040000000000000036,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_9",
          x: -0.9,
          y: -1.04,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_6",
      center: {
        x: 0.3725,
        y: 0.10000000000000003,
      },
      width: 1.045,
      height: 0.7600000000000001,
      pins: [
        {
          pinId: "schematic_port_10",
          x: 0.3,
          y: 0.4800000000000001,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_11",
          x: 0.3,
          y: -0.28,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_7",
      center: {
        x: 1.85,
        y: 0.10000000000000003,
      },
      width: 1.6680000000000001,
      height: 1.984,
      pins: [
        {
          pinId: "schematic_port_12",
          x: 1.016,
          y: 0.2,
        },
        {
          pinId: "schematic_port_13",
          x: 2.684,
          y: 0.2,
        },
        {
          pinId: "schematic_port_14",
          x: 1.016,
          y: 0,
        },
        {
          pinId: "schematic_port_15",
          x: 2.684,
          y: 0,
        },
      ],
    },
    {
      chipId: "L1",
      center: {
        x: 3.3,
        y: 1.401,
      },
      width: 1.0558250000000005,
      height: 0.8677407000000001,
      pins: [
        {
          pinId: "schematic_port_16",
          x: 2.7720874999999997,
          y: 1.401,
        },
        {
          pinId: "schematic_port_17",
          x: 3.8279125,
          y: 1.401,
        },
      ],
    },
    {
      chipId: "L5",
      center: {
        x: 3.25,
        y: -0.535,
      },
      width: 1.0558250000000005,
      height: 0.8677407000000001,
      pins: [
        {
          pinId: "schematic_port_18",
          x: 2.7220874999999998,
          y: -0.535,
        },
        {
          pinId: "schematic_port_19",
          x: 3.7779125,
          y: -0.535,
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: "48V_Vout",
      netLabelWidth: 1.2,
      pinIds: ["schematic_port_0", "schematic_port_12"],
    },
    {
      netId: "48V_Vout1",
      pinIds: ["schematic_port_0", "schematic_port_1"],
    },
    {
      netId: ".D2 > .pin1 to .U_REPEAT > .pin1",
      pinIds: ["schematic_port_2", "schematic_port_0"],
    },
    {
      netId: ".D3 > .pin1 to .U_REPEAT > .pin1",
      pinIds: ["schematic_port_4", "schematic_port_0"],
    },
    {
      netId: ".R109 > .pin1 to .U_REPEAT > .pin1",
      netLabelWidth: 1.2,
      pinIds: ["schematic_port_6", "schematic_port_0"],
    },
    {
      netId: ".R109 > .pin2 to .D27 > .pin1",
      pinIds: ["schematic_port_7", "schematic_port_8"],
    },
    {
      netId: ".C2 > .pin1 to .U_REPEAT > .pin1",
      netLabelWidth: 1.2,
      pinIds: ["schematic_port_10", "schematic_port_0"],
    },
    {
      netId: ".L3 > .pin2 to .L1 > .pin1",
      pinIds: ["schematic_port_13", "schematic_port_16"],
    },
    {
      netId: ".L3 > .pin4 to .L5 > .pin1",
      pinIds: ["schematic_port_15", "schematic_port_18"],
    },
  ],
  netConnections: [
    {
      netId: "V48_Vout2",
      netLabelWidth: 0.42,
      netLabelHeight: 1.2,
      pinIds: [
        "schematic_port_0",
        "schematic_port_1",
        "schematic_port_2",
        "schematic_port_4",
        "schematic_port_6",
        "schematic_port_10",
        "schematic_port_12",
      ],
    },
    {
      netId: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: [
        "schematic_port_3",
        "schematic_port_5",
        "schematic_port_9",
        "schematic_port_11",
        "schematic_port_14",
      ],
    },
    {
      netId: "Power_OUTPUT_P",
      netLabelWidth: 1.8,
      pinIds: ["schematic_port_17"],
    },
    {
      netId: "Power_OUTPUT_N",
      netLabelWidth: 1.8,
      pinIds: ["schematic_port_19"],
    },
  ],
  textBoxes: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -4.57,
        y: 1.7150000000000003,
      },
      width: 3.4799999999999995,
      height: 0.2500000000000002,
      text: "REPEAT(F,1,2) TPS2663.SchDoc",
    },
    {
      chipId: "schematic_component_7",
      center: {
        x: 2.736,
        y: -1.022,
      },
      width: 2.6399999999999997,
      height: 0.18000000000000005,
      text: "6.8uH coupled inductor",
    },
    {
      chipId: "schematic_component_7",
      center: {
        x: 1.536,
        y: 1.2070000000000003,
      },
      width: 0.3600000000000001,
      height: 0.2500000000000002,
      text: "L3",
    },
  ],
  availableNetLabelOrientations: {
    V48_Vout2: ["y+"],
    GND: ["y-"],
    Power_OUTPUT_P: ["x-", "x+"],
    Power_OUTPUT_N: ["x-", "x+"],
  },
  maxMspPairDistance: 2.4,
  _hideRatsNet: false,
} satisfies InputProblem
