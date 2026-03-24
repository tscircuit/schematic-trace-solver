import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

/**
 * Example reproducing extra trace lines from Issue #78.
 *
 * When UntangleTraceSubsolver reroutes L-shaped corners, the path
 * concatenation can produce consecutive duplicate points, resulting
 * in zero-length "extra" trace segments that render as visual artifacts.
 *
 * This circuit forces the untangle step to reroute by placing chips
 * close together with crossing traces and a high maxMspPairDistance.
 */
export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 2,
      height: 1.2,
      pins: [
        { pinId: "U1.1", x: -1, y: 0.4 },
        { pinId: "U1.2", x: -1, y: -0.4 },
        { pinId: "U1.3", x: 1, y: 0.4 },
        { pinId: "U1.4", x: 1, y: -0.4 },
      ],
    },
    {
      chipId: "R1",
      center: { x: -3.5, y: 2 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "R1.1", x: -3.5, y: 2.5 },
        { pinId: "R1.2", x: -3.5, y: 1.5 },
      ],
    },
    {
      chipId: "R2",
      center: { x: 3.5, y: 2 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "R2.1", x: 3.5, y: 2.5 },
        { pinId: "R2.2", x: 3.5, y: 1.5 },
      ],
    },
    {
      chipId: "C1",
      center: { x: -3.5, y: -2 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C1.1", x: -3.5, y: -1.5 },
        { pinId: "C1.2", x: -3.5, y: -2.5 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 3.5, y: -2 },
      width: 0.6,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 3.5, y: -1.5 },
        { pinId: "C2.2", x: 3.5, y: -2.5 },
      ],
    },
  ],
  directConnections: [
    { pinIds: ["U1.1", "R2.2"], netId: "NET1" },
    { pinIds: ["U1.3", "R1.2"], netId: "NET2" },
    { pinIds: ["U1.2", "C2.1"], netId: "NET3" },
    { pinIds: ["U1.4", "C1.1"], netId: "NET4" },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 6,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
