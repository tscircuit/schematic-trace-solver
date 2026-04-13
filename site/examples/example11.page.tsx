import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -1.03,
        y: 0.765,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: -1.58,
          y: 0.765,
        },
        {
          pinId: "R1.2",
          x: -0.48,
          y: 0.765,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 1.03,
        y: 0.765,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R2.1",
          x: 0.48,
          y: 0.765,
        },
        {
          pinId: "R2.2",
          x: 1.58,
          y: 0.765,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -1.03,
        y: -0.765,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R3.1",
          x: -1.58,
          y: -0.765,
        },
        {
          pinId: "R3.2",
          x: -0.48,
          y: -0.765,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 1.03,
        y: -0.765,
      },
      width: 0.88,
      height: 0.53,
      pins: [
        {
          pinId: "J1.1",
          x: 0.5800000000000001,
          y: -0.665,
        },
        {
          pinId: "J1.2",
          x: 1.03,
          y: -1.0150000000000001,
        },
        {
          pinId: "J1.3",
          x: 1.48,
          y: -0.665,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["R2.1", "R3.2"],
      netId: ".R2 > .pin1 to .R3 > .pin2",
    },
    {
      pinIds: ["R2.2", "R3.1"],
      netId: ".R2 > .pin2 to .R3 > .pin1",
    },
    {
      pinIds: ["J1.1", "R1.1"],
      netId: ".J1 > .pin1 to .R1 > .pin1",
    },
    {
      pinIds: ["J1.3", "R1.2"],
      netId: ".J1 > .pin3 to .R1 > .pin2",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
