import type { InputProblem } from "lib/types/InputProblem"
import { PipelineDebugger } from "site/components/PipelineDebugger"

/**
 * Issue #34 Reproduction: Fragmented same-net trace lines
 *
 * This example demonstrates the issue where trace lines on the same net
 * are split into fragments at intermediate points: (0, 0)-(2, 0), (2, 0)-(5, 0),
 * and (5, 0)-(10, 0), which should be merged into a single line (0, 0)-(10, 0).
 *
 * The solver's TraceCleanupSolver.mergeCollinearTraces function should
 * identify these collinear segments and merge them into a single continuous path.
 */
export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: -2, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U1.1",
          x: -2.8,
          y: 0.2,
        },
        {
          pinId: "U1.2",
          x: -2.8,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: -2.8,
          y: -0.2,
        },
        {
          pinId: "U1.4",
          x: -1.2,
          y: -0.2,
        },
        {
          pinId: "U1.5",
          x: -1.2,
          y: 0,
        },
        {
          pinId: "U1.6",
          x: -1.2,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "U2",
      center: { x: 8, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        {
          pinId: "U2.1",
          x: 7.2,
          y: 0.2,
        },
        {
          pinId: "U2.2",
          x: 7.2,
          y: 0,
        },
        {
          pinId: "U2.3",
          x: 7.2,
          y: -0.2,
        },
        {
          pinId: "U2.4",
          x: 8.8,
          y: -0.2,
        },
        {
          pinId: "U2.5",
          x: 8.8,
          y: 0,
        },
        {
          pinId: "U2.6",
          x: 8.8,
          y: 0.2,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "U2.1"],
      netId: "SIGNAL",
    },
  ],
  netConnections: [
    {
      pinIds: ["U1.2", "U2.2"],
      netId: "GND",
    },
    {
      pinIds: ["U1.3", "U2.3"],
      netId: "VCC",
    },
  ],
  availableNetLabelOrientations: {
    SIGNAL: ["y+"],
    GND: ["y-"],
    VCC: ["y-"],
  },
  maxMspPairDistance: 15,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
