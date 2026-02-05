/**
 * Example demonstrating the merge of collinear traces on the same net.
 * This tests issue #34 - merging same-net trace lines that are close together.
 */
import { Page } from "react-cosmos"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { PipelineDebugger } from "site/components/PipelineDebugger"

const inputProblem = {
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
    directConnections: [
        { pinIds: ["pin2", "pin3"], netId: "net1" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
}

export default () => {
    const solver = new SchematicTracePipelineSolver(inputProblem)

    return (
        <Page>
            <h1>Example 29: Merge Collinear Traces (Issue #34)</h1>
            <p>
                This example demonstrates merging trace segments that belong to the same
                net and are collinear (aligned on the same axis) and close together.
            </p>
            <p>
                Two pins connected with a trace that might be fragmented should be
                merged into a single continuous line segment.
            </p>
            <PipelineDebugger solver={solver} />
        </Page>
    )
}
