/**
 * Example demonstrating the merge of collinear traces on the same net.
 * This tests issue #34 - merging same-net trace lines that are close together.
 */
import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "chip1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [
        { pinId: "pin1", x: -0.5, y: 0 },
        { pinId: "pin2", x: 0.5, y: 0 },
      ],
    },
    {
      chipId: "chip2",
      center: { x: 3, y: 0 },
      width: 1,
      height: 1,
      pins: [
        { pinId: "pin3", x: 2.5, y: 0 },
        { pinId: "pin4", x: 3.5, y: 0 },
      ],
    },
  ],
  directConnections: [{ pinIds: ["pin2", "pin3"], netId: "net1" }],
  netConnections: [],
  availableNetLabelOrientations: {},
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
