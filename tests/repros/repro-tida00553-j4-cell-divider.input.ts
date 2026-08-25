import type { InputProblem } from "lib/types/InputProblem"

const horizontalResistor = (name: string, x: number) => ({
  chipId: name,
  center: { x, y: 1.2 },
  width: 1.1,
  height: 0.9,
  pins: [
    {
      pinId: `${name}.1`,
      displayName: "1",
      x: x - 0.55,
      y: 1.2,
      _facingDirection: "x-" as const,
    },
    {
      pinId: `${name}.2`,
      displayName: "2",
      x: x + 0.55,
      y: 1.2,
      _facingDirection: "x+" as const,
    },
  ],
})

// Isolated from the TIDA-00553 battery-pack cell-count selector. R26-R29
// form the VFB divider, J4 pins 1/3/5 tap its intermediate nodes, and J4 pins
// 2/4/6 share the ground end of the divider.
const inputProblem: InputProblem = {
  chips: [
    horizontalResistor("R26", -3.6),
    horizontalResistor("R27", -2.2),
    horizontalResistor("R28", -0.8),
    horizontalResistor("R29", 0.6),
    {
      chipId: "J4",
      center: { x: 0.25, y: -0.25 },
      width: 1.2,
      height: 1.8,
      pins: [
        {
          pinId: "J4.1",
          displayName: "1",
          x: -0.35,
          y: 0.15,
          _facingDirection: "x-",
        },
        {
          pinId: "J4.2",
          displayName: "2",
          x: 0.85,
          y: 0.15,
          _facingDirection: "x+",
        },
        {
          pinId: "J4.3",
          displayName: "3",
          x: -0.35,
          y: -0.25,
          _facingDirection: "x-",
        },
        {
          pinId: "J4.4",
          displayName: "4",
          x: 0.85,
          y: -0.25,
          _facingDirection: "x+",
        },
        {
          pinId: "J4.5",
          displayName: "5",
          x: -0.35,
          y: -0.65,
          _facingDirection: "x-",
        },
        {
          pinId: "J4.6",
          displayName: "6",
          x: 0.85,
          y: -0.65,
          _facingDirection: "x+",
        },
      ],
    },
  ],
  directConnections: [
    { netId: "4-Cell rail", pinIds: ["R26.2", "R27.1"] },
    {
      netId: "4-Cell",
      netLabelText: "J4_5",
      netLabelWidth: 0.72,
      pinIds: ["R26.2", "J4.5"],
    },
    { netId: "3-Cell rail", pinIds: ["R27.2", "R28.1"] },
    { netId: "3-Cell tap", pinIds: ["R27.2", "J4.3"] },
    { netId: "2-Cell rail", pinIds: ["R28.2", "R29.1"] },
    { netId: "2-Cell tap", pinIds: ["R28.2", "J4.1"] },
  ],
  netConnections: [
    {
      netId: "U2_VFB",
      netLabelText: "U2_VFB",
      netLabelWidth: 1.12,
      pinIds: ["R26.1"],
    },
    {
      netId: "GND",
      netLabelText: "GND",
      netLabelWidth: 0.42,
      netLabelHeight: 0.68,
      pinIds: ["R29.2", "J4.2", "J4.4", "J4.6"],
    },
  ],
  textBoxes: [
    ...[
      ["R26", -3.6, "26.1kΩ"],
      ["R27", -2.2, "9.53kΩ"],
      ["R28", -0.8, "20.5kΩ"],
      ["R29", 0.6, "78.7kΩ"],
    ].flatMap(([name, x, value]) => [
      {
        chipId: name as string,
        center: { x: x as number, y: 1.68 },
        width: 0.56,
        height: 0.22,
        text: name as string,
      },
      {
        chipId: name as string,
        center: { x: x as number, y: 0.72 },
        width: 0.84,
        height: 0.22,
        text: value as string,
      },
    ]),
    {
      chipId: "J4",
      center: { x: -0.15, y: -1.23 },
      width: 0.38,
      height: 0.22,
      text: "J4",
    },
  ],
  availableNetLabelOrientations: {
    U2_VFB: ["x-"],
    "4-Cell": ["x-"],
    GND: ["y-"],
  },
  maxMspPairDistance: 2.4,
}

export default inputProblem
