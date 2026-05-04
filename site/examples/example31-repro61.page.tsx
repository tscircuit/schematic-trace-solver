import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U1_1", x: 0, y: 0 }],
    },
    {
      chipId: "U2",
      center: { x: 20, y: 20 },
      width: 1,
      height: 1,
      pins: [{ pinId: "U2_1", x: 20, y: 20 }],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "VCC", pinIds: ["U1_1"] },
    { netId: "VCC", pinIds: ["U2_1"] },
  ],
  availableNetLabelOrientations: {},
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
