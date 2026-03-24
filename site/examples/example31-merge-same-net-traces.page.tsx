import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

/**
 * Example demonstrating same-net trace merging (Issue #34).
 *
 * Two VCC traces connect from opposite sides of U1 to R1 and R2.
 * They may have parallel segments that run close together. After
 * the merge phase in TraceCleanupSolver, these should be aligned.
 */
export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.2 },
        { pinId: "U1.2", x: -0.8, y: -0.2 },
        { pinId: "U1.3", x: 0.8, y: 0.2 },
        { pinId: "U1.4", x: 0.8, y: -0.2 },
      ],
    },
    {
      chipId: "R1",
      center: { x: -3, y: 1 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R1.1", x: -3, y: 1.5 },
        { pinId: "R1.2", x: -3, y: 0.5 },
      ],
    },
    {
      chipId: "R2",
      center: { x: 3, y: 1 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R2.1", x: 3, y: 1.5 },
        { pinId: "R2.2", x: 3, y: 0.5 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -3, y: -1 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: -3, y: -0.5 },
        { pinId: "C1.2", x: -3, y: -1.5 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "R1.2"], netId: "VCC" },
    { pinIds: ["U1.3", "R2.2"], netId: "VCC" },
    { pinIds: ["U1.2", "C1.1"], netId: "GND" },
  ],
  netConnections: [
    {
      pinIds: ["R1.1", "R2.1"],
      netId: "VOUT",
    },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
    VOUT: ["y+", "y-"],
  },
  maxMspPairDistance: 8,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
