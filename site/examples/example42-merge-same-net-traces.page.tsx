import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

/**
 * Example demonstrating same-net trace merging.
 *
 * Two identical sub-circuits, each with:
 * - A VCC trace from U1 to R1 (upper side)
 * - A VCC trace from U2 to R2 (upper side)
 *
 * These same-net VCC traces run parallel and close together.
 * After the merging_parallel_segments phase, the parallel
 * segments should be aligned to the same Y coordinate.
 *
 * This tests the clustering approach: multiple parallel
 * segments on the same net should snap to their average.
 */
export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -2.8, y: 0.2 },
        { pinId: "U1.2", x: -2.8, y: -0.2 },
        { pinId: "U1.3", x: -1.2, y: 0.2 },
        { pinId: "U1.4", x: -1.2, y: -0.2 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 2, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U2.1", x: 1.2, y: 0.2 },
        { pinId: "U2.2", x: 1.2, y: -0.2 },
        { pinId: "U2.3", x: 2.8, y: 0.2 },
        { pinId: "U2.4", x: 2.8, y: -0.2 },
      ],
    },
    {
      chipId: "R1",
      center: { x: -4, y: 1.5 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R1.1", x: -4, y: 2.0 },
        { pinId: "R1.2", x: -4, y: 1.0 },
      ],
    },
    {
      chipId: "R2",
      center: { x: 4, y: 1.5 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R2.1", x: 4, y: 2.0 },
        { pinId: "R2.2", x: 4, y: 1.0 },
      ],
    },
    {
      chipId: "R3",
      center: { x: -4, y: -1.5 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R3.1", x: -4, y: -1.0 },
        { pinId: "R3.2", x: -4, y: -2.0 },
      ],
    },
    {
      chipId: "R4",
      center: { x: 4, y: -1.5 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "R4.1", x: 4, y: -1.0 },
        { pinId: "R4.2", x: 4, y: -2.0 },
      ],
    },
  ],
  directConnections: [
    // VCC net: U1.1 -> R1.2  and  U2.1 -> R2.2  and  U1.3 -> R3.2  and  U2.3 -> R4.2
    { pinIds: ["U1.1", "R1.2"], netId: "VCC" },
    { pinIds: ["U2.1", "R2.2"], netId: "VCC" },
    { pinIds: ["U1.3", "R3.2"], netId: "VCC" },
    { pinIds: ["U2.3", "R4.2"], netId: "VCC" },
    // GND net
    { pinIds: ["U1.2", "U2.2"], netId: "GND" },
    { pinIds: ["U1.4", "U2.4"], netId: "GND" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 10,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
