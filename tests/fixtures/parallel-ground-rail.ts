import type { InputProblem } from "lib/types/InputProblem"

export const createParallelGroundRailProblem = (): InputProblem => ({
  chips: [
    ...[
      ["A", 0, 1],
      ["B", 1, 1],
      ["C", 1, -2],
      ["D", -1, -3.5],
    ].map(([id, x, y]) => ({
      chipId: String(id),
      center: { x: Number(x), y: Number(y) + 0.4 },
      width: 0.4,
      height: 0.8,
      pins: [
        {
          pinId: `${id}.1`,
          x: Number(x),
          y: Number(y) + 0.8,
          _facingDirection: "y+" as const,
        },
        {
          pinId: `${id}.2`,
          x: Number(x),
          y: Number(y),
          _facingDirection: "y-" as const,
        },
      ],
    })),
    {
      chipId: "U",
      center: { x: 2.5, y: 1.5 },
      width: 1,
      height: 3,
      pins: [
        { pinId: "U.GND", x: 2, y: 0.6, _facingDirection: "x-" },
        { pinId: "U.VIN", x: 2, y: 2, _facingDirection: "x-" },
        { pinId: "U.IO", x: 2, y: 2.4, _facingDirection: "x-" },
      ],
    },
  ],
  directConnections: [{ pinIds: ["A.2", "B.2"] }, { pinIds: ["A.2", "U.GND"] }],
  netConnections: [
    {
      netId: "GND",
      pinIds: ["U.GND", "A.2", "B.2", "C.2", "D.2"],
      netLabelWidth: 0.42,
      netLabelHeight: 0.48,
    },
  ],
  availableNetLabelOrientations: { GND: ["y-"] },
  maxMspPairDistance: 6,
})
