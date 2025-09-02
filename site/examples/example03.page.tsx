import type { InputProblem } from "lib/index"
import { PipelineDebugger } from "site/components/PipelineDebugger"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -3,
        y: 1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN1_PIN2.1",
          x: -3.4724184500000006,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN2.2",
          x: -3.4724184500000006,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN2.3",
          x: -2.5275815499999994,
          y: 1.4485175000000003,
        },
        {
          pinId: "PIN1_PIN2.4",
          x: -2.5275815499999994,
          y: 1.4485175000000003,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 0,
        y: 1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN1_PIN3.1",
          x: -0.4724184500000006,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN3.2",
          x: -0.4724184500000006,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN3.3",
          x: 0.4724184500000006,
          y: 1.4485175000000003,
        },
        {
          pinId: "PIN1_PIN3.4",
          x: 0.4724184500000006,
          y: 1.4485175000000003,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 3,
        y: 1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN1_PIN4.1",
          x: 2.5275815499999994,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN4.2",
          x: 2.5275815499999994,
          y: 1.4489565000000004,
        },
        {
          pinId: "PIN1_PIN4.3",
          x: 3.4724184500000006,
          y: 1.4485175000000003,
        },
        {
          pinId: "PIN1_PIN4.4",
          x: 3.4724184500000006,
          y: 1.4485175000000003,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -3,
        y: -1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN2_PIN3.1",
          x: -3.4724184500000006,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN2_PIN3.2",
          x: -3.4724184500000006,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN2_PIN3.3",
          x: -2.5275815499999994,
          y: -1.5514824999999997,
        },
        {
          pinId: "PIN2_PIN3.4",
          x: -2.5275815499999994,
          y: -1.5514824999999997,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 0,
        y: -1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN2_PIN4.1",
          x: -0.4724184500000006,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN2_PIN4.2",
          x: -0.4724184500000006,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN2_PIN4.3",
          x: 0.4724184500000006,
          y: -1.5514824999999997,
        },
        {
          pinId: "PIN2_PIN4.4",
          x: 0.4724184500000006,
          y: -1.5514824999999997,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 3,
        y: -1.5,
      },
      width: 1.0011537820000012,
      height: 0.44923699999999833,
      pins: [
        {
          pinId: "PIN3_PIN4.1",
          x: 2.5275815499999994,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN3_PIN4.2",
          x: 2.5275815499999994,
          y: -1.5510434999999996,
        },
        {
          pinId: "PIN3_PIN4.3",
          x: 3.4724184500000006,
          y: -1.5514824999999997,
        },
        {
          pinId: "PIN3_PIN4.4",
          x: 3.4724184500000006,
          y: -1.5514824999999997,
        },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    {
      netId: "PIN1",
      pinIds: ["PIN1_PIN2.1", "PIN1_PIN3.1", "PIN1_PIN4.1"],
    },
    {
      netId: "PIN2",
      pinIds: ["PIN1_PIN2.2", "PIN2_PIN3.2", "PIN2_PIN4.2"],
    },
    {
      netId: "PIN3",
      pinIds: ["PIN1_PIN3.3", "PIN2_PIN3.3", "PIN3_PIN4.3"],
    },
    {
      netId: "PIN4",
      pinIds: ["PIN1_PIN4.4", "PIN2_PIN4.4", "PIN3_PIN4.4"],
    },
  ],
  availableNetLabelOrientations: {},
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
