/**
 * Demo page for issue #79:
 * "Fix extra net label in repro61, or remove trace"
 *
 * This circuit has VCC and GND connected exclusively via netConnections
 * with availableNetLabelOrientations.  Before the fix both nets also
 * produced spurious wire traces on top of their net labels.  After the
 * fix only the two signal traces (U1.out→R1.pin1, U1.sigA→R1.pin2)
 * are drawn; VCC and GND are shown by net labels only.
 */
import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2.4,
      height: 1.0,
      pins: [
        { pinId: "U1.1", x: -1.2, y: 0.3 },
        { pinId: "U1.2", x: -1.2, y: 0.1 },
        { pinId: "U1.3", x: -1.2, y: -0.3 },
        { pinId: "U1.4", x: 1.2, y: 0.3 },
      ],
    },
    {
      chipId: "R1",
      center: { x: 2.5, y: 0.3 },
      width: 1.0,
      height: 0.4,
      pins: [
        { pinId: "R1.1", x: 2.0, y: 0.3 },
        { pinId: "R1.2", x: 3.0, y: 0.3 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -2.5, y: -0.3 },
      width: 0.5,
      height: 0.8,
      pins: [
        { pinId: "C1.1", x: -2.5, y: 0.1 },
        { pinId: "C1.2", x: -2.5, y: -0.7 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.4", "R1.1"], netId: "U1.out to R1.pin1" },
    { pinIds: ["U1.2", "R1.2"], netId: "U1.sigA to R1.pin2" },
  ],
  netConnections: [
    { netId: "VCC", pinIds: ["U1.1", "C1.1"] },
    { netId: "GND", pinIds: ["U1.3", "C1.2"] },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
