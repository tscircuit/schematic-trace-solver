import type { InputProblem } from "lib/types/InputProblem"

export default {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -4.5,
        y: 1.3,
      },
      width: 1.0558250000000005,
      height: 0.8677407000000001,
      pins: [
        {
          pinId: "schematic_port_0",
          x: -5.0279125,
          y: 1.3026245499999998,
        },
        {
          pinId: "schematic_port_1",
          x: -3.9720874999999998,
          y: 1.2973754500000003,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -4.5,
        y: -1.3,
      },
      width: 1.0558250000000005,
      height: 0.8677407000000001,
      pins: [
        {
          pinId: "schematic_port_2",
          x: -5.0279125,
          y: -1.2973754500000003,
        },
        {
          pinId: "schematic_port_3",
          x: -3.9720874999999998,
          y: -1.3026245499999998,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -3,
        y: 0,
      },
      width: 1.6680000000000001,
      height: 1.984,
      pins: [
        {
          pinId: "schematic_port_4",
          x: -3.834,
          y: 0.1,
        },
        {
          pinId: "schematic_port_5",
          x: -2.166,
          y: 0.1,
        },
        {
          pinId: "schematic_port_6",
          x: -3.834,
          y: -0.1,
        },
        {
          pinId: "schematic_port_7",
          x: -2.166,
          y: -0.1,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -1.7887499999999998,
        y: 1.6,
      },
      width: 0.7225000000000001,
      height: 0.20000000000000018,
      pins: [
        {
          pinId: "schematic_port_8",
          x: -2.15,
          y: 1.6,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: -1.4275,
        y: 0,
      },
      width: 1.045,
      height: 0.76,
      pins: [
        {
          pinId: "schematic_port_9",
          x: -1.5,
          y: 0.38,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_10",
          x: -1.5,
          y: -0.38,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: -0.4976361625000001,
        y: 0.7,
      },
      width: 0.8841830249999991,
      height: 1.04,
      pins: [
        {
          pinId: "schematic_port_11",
          x: -0.705,
          y: 1.22,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_12",
          x: -0.695,
          y: 0.17999999999999988,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_6",
      center: {
        x: 1.415,
        y: 0.3,
      },
      width: 1.33,
      height: 0.6,
      pins: [
        {
          pinId: "schematic_port_13",
          x: 1.2,
          y: 0.6,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_14",
          x: 1.2,
          y: 0,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_7",
      center: {
        x: 1.3849999999999998,
        y: -0.7,
      },
      width: 0.99,
      height: 1.08,
      pins: [
        {
          pinId: "schematic_port_15",
          x: 1.2,
          y: -0.15999999999999992,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_16",
          x: 1.2,
          y: -1.24,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_8",
      center: {
        x: 2.3999999999999995,
        y: 0.30000000000000004,
      },
      width: 0.7399999999999998,
      height: 1.04,
      pins: [
        {
          pinId: "schematic_port_17",
          x: 2.3,
          y: 0.8200000000000001,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_18",
          x: 2.3,
          y: -0.22000000000000003,
          _facingDirection: "y-",
        },
      ],
    },
    {
      chipId: "schematic_component_9",
      center: {
        x: 3.8,
        y: 0.30000000000000004,
      },
      width: 0.7399999999999998,
      height: 1.04,
      pins: [
        {
          pinId: "schematic_port_19",
          x: 3.7,
          y: 0.8200000000000001,
          _facingDirection: "y+",
        },
        {
          pinId: "schematic_port_20",
          x: 3.7,
          y: -0.22000000000000003,
          _facingDirection: "y-",
        },
      ],
    },
  ],
  directConnections: [
    {
      netId: ".L2 > .pin2 to .L4 > .pin1",
      pinIds: ["schematic_port_1", "schematic_port_4"],
    },
    {
      netId: ".L6 > .pin2 to .L4 > .pin3",
      pinIds: ["schematic_port_3", "schematic_port_6"],
    },
    {
      netId: ".TP3 > .pin1 to .L4 > .pin2",
      pinIds: ["schematic_port_8", "schematic_port_5"],
    },
    {
      netId: ".C3 > .pin1 to .L4 > .pin2",
      pinIds: ["schematic_port_9", "schematic_port_5"],
    },
    {
      netId: ".D29 > .pin1 to .L4 > .pin2",
      pinIds: ["schematic_port_11", "schematic_port_5"],
    },
    {
      netId: ".D29 > .pin2 to .R108 > .pin1",
      pinIds: ["schematic_port_12", "schematic_port_13"],
    },
    {
      netId: ".R108 > .pin2 to .D26 > .pin1",
      pinIds: ["schematic_port_14", "schematic_port_15"],
    },
    {
      netId: ".D4 > .pin1 to .L4 > .pin2",
      netLabelWidth: 0.96,
      pinIds: ["schematic_port_17", "schematic_port_5"],
    },
    {
      netId: ".D5 > .pin1 to .L4 > .pin2",
      netLabelWidth: 0.96,
      pinIds: ["schematic_port_19", "schematic_port_5"],
    },
  ],
  netConnections: [
    {
      netId: "Power_INPUT_P",
      netLabelWidth: 1.68,
      pinIds: ["schematic_port_0"],
    },
    {
      netId: "Power_INPUT_N",
      netLabelWidth: 1.68,
      pinIds: ["schematic_port_2"],
    },
    {
      netId: "V48_Vin",
      netLabelWidth: 0.42,
      netLabelHeight: 0.96,
      pinIds: [
        "schematic_port_5",
        "schematic_port_8",
        "schematic_port_9",
        "schematic_port_11",
        "schematic_port_17",
        "schematic_port_19",
      ],
    },
    {
      netId: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
      pinIds: [
        "schematic_port_7",
        "schematic_port_10",
        "schematic_port_16",
        "schematic_port_18",
        "schematic_port_20",
      ],
    },
  ],
  textBoxes: [
    {
      chipId: "schematic_component_2",
      center: {
        x: -2.1140000000000003,
        y: -1.1219999999999999,
      },
      width: 2.6399999999999997,
      height: 0.18000000000000016,
      text: "6.8uH coupled inductor",
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -3.314,
        y: 1.1070000000000002,
      },
      width: 0.3600000000000003,
      height: 0.2500000000000002,
      text: "L4",
    },
  ],
  availableNetLabelOrientations: {
    Power_INPUT_P: ["x-", "x+"],
    Power_INPUT_N: ["x-", "x+"],
    V48_Vin: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
  _hideRatsNet: false,
} satisfies InputProblem
