
import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
    chips: [
        {
            chipId: "U1",
            center: { x: 0, y: 0 },
            width: 0.5,
            height: 0.5,
            pins: [
                { pinId: "U1.1", x: -1, y: 0.01 },
                { pinId: "U1.2", x: 1, y: 0.01 },
            ],
        },
        {
            chipId: "U2",
            center: { x: 0, y: 1 },
            width: 0.5,
            height: 0.5,
            pins: [
                { pinId: "U2.1", x: -1, y: -0.01 },
                { pinId: "U2.2", x: 1, y: -0.01 },
            ],
        },
    ],
    directConnections: [
        {
            pinIds: ["U1.1", "U1.2"],
            netId: "NET1",
        },
        {
            pinIds: ["U2.1", "U2.2"],
            netId: "NET1",
        },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
