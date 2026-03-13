import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Example demonstrating same-net trace line merging.
 *
 * Three chips connected on two nets. The pin positions are set up so that
 * traces on the same net will be routed as close parallel lines that should
 * be merged onto the same Y or X coordinate.
 */
export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -3, y: 0 },
      width: 1.0,
      height: 1.6,
      pins: [
        { pinId: "U1.1", x: -3.5, y: 0.4 },
        { pinId: "U1.2", x: -3.5, y: -0.4 },
        { pinId: "U1.3", x: -2.5, y: 0.4 },
        { pinId: "U1.4", x: -2.5, y: -0.4 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 0, y: 1.5 },
      width: 1.0,
      height: 1.0,
      pins: [
        { pinId: "U2.1", x: -0.5, y: 1.5 },
        { pinId: "U2.2", x: 0.5, y: 1.5 },
      ],
    },
    {
      chipId: "U3",
      center: { x: 3, y: 0 },
      width: 1.0,
      height: 1.6,
      pins: [
        { pinId: "U3.1", x: 2.5, y: 0.4 },
        { pinId: "U3.2", x: 2.5, y: -0.4 },
        { pinId: "U3.3", x: 3.5, y: 0.4 },
        { pinId: "U3.4", x: 3.5, y: -0.4 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "net_a",
      pinIds: ["U1.3", "U2.1", "U3.1"],
    },
    {
      netId: "net_b",
      pinIds: ["U1.4", "U2.2", "U3.2"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 4,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
