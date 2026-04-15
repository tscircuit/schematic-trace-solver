/**
 * Reproduction for:
 * - https://github.com/tscircuit/schematic-trace-solver/issues/29
 * - https://github.com/tscircuit/schematic-trace-solver/issues/34
 *
 * Two decoupling capacitors share the same GND net with a main chip.
 * Their GND pins are at slightly different Y coordinates (0.025 apart each),
 * so the traces routed to them form two near-parallel horizontal segments.
 * The SameNetTraceMergeSolver snaps both segments onto the same Y axis,
 * eliminating the visual clutter.
 */
import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1,
      pins: [
        { pinId: "U1.VCC", x: -1, y: 0.25 },
        // Two GND pins at slightly different Y — produces near-parallel same-net segments
        { pinId: "U1.GND1", x: -1, y: -0.025 },
        { pinId: "U1.GND2", x: -1, y: 0.025 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -3, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: -3, y: 0.5 },
        { pinId: "C1.2", x: -3, y: -0.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: -5, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: -5, y: 0.5 },
        { pinId: "C2.2", x: -5, y: -0.5 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.VCC", "C1.1", "C2.1"], netId: "VCC" },
  ],
  netConnections: [
    // GND connects three pins — U1.GND1 and U1.GND2 are only 0.05 apart,
    // causing the two traces to run nearly parallel.
    { pinIds: ["U1.GND1", "U1.GND2", "C1.2", "C2.2"], netId: "GND" },
  ],
  availableNetLabelOrientations: {
    VCC: ["y+"],
    GND: ["y-"],
  },
  maxMspPairDistance: 10,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
