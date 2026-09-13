import type { InputProblem } from "lib/types/InputProblem"

// An independent, single-capacitor circuit with two named-net connections.
export const labeledDecouplingCapacitor: InputProblem = {
  chips: [
    {
      chipId: "C1",
      symbolName: "capacitor_down",
      center: { x: 0, y: 0 },
      width: 0.4,
      height: 0.76,
      pins: [
        { pinId: "C1.1", x: 0, y: 0.38, _facingDirection: "y+" },
        { pinId: "C1.2", x: 0, y: -0.38, _facingDirection: "y-" },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "VCC",
      netLabelText: "VCC",
      pinIds: ["C1.1"],
      isGround: false,
      netLabelWidth: 0.42,
    },
    {
      netId: "GND",
      netLabelText: "GND",
      pinIds: ["C1.2"],
      isGround: true,
      netLabelWidth: 0.42,
    },
  ],
  availableNetLabelOrientations: { VCC: ["y+"], GND: ["y-"] },
}
