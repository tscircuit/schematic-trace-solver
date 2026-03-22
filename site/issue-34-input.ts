import type { InputProblem } from "lib/types/InputProblem"

/**
 * Issue #34 repro + integration test — two ICs, VCC/GND direct ties. Orthogonal
 * routes use a shared horizontal alley (y≈±0.6) so VCC and GND traces run
 * parallel between the chips after overlap shifting.
 */
export const issue34InputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2.5, y: 0 },
      width: 1.6,
      height: 0.8,
      pins: [
        { pinId: "U1.1", x: -3.3, y: 0.15 },
        { pinId: "U1.2", x: -3.3, y: -0.15 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 2.5, y: 0 },
      width: 1.6,
      height: 0.8,
      pins: [
        { pinId: "U2.1", x: 1.7, y: 0.15 },
        { pinId: "U2.2", x: 1.7, y: -0.15 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "U2.1"], netId: "VCC" },
    { pinIds: ["U1.2", "U2.2"], netId: "GND" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {
    VCC: ["y+", "y-", "x+", "x-"],
    GND: ["y+", "y-", "x+", "x-"],
  },
  maxMspPairDistance: 20,
}
