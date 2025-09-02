import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 4,
        y: 0,
      },
      width: 1.1025814,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 3.4487093,
          y: 0.0002732499999993365,
        },
        {
          pinId: "R1.2",
          x: 4.5512907,
          y: -0.0002732499999993365,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 0,
        y: 0,
      },
      width: 1.2000000000000002,
      height: 1,
      pins: [
        {
          pinId: "U1.1",
          x: -0.6000000000000001,
          y: 0.30000000000000004,
        },
        {
          pinId: "U1.2",
          x: -0.6000000000000001,
          y: 0.10000000000000003,
        },
        {
          pinId: "U1.3",
          x: -0.6000000000000001,
          y: -0.09999999999999998,
        },
        {
          pinId: "U1.4",
          x: -0.6000000000000001,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.5",
          x: 0.6000000000000001,
          y: -0.30000000000000004,
        },
        {
          pinId: "U1.6",
          x: 0.6000000000000001,
          y: -0.10000000000000003,
        },
        {
          pinId: "U1.7",
          x: 0.6000000000000001,
          y: 0.09999999999999998,
        },
        {
          pinId: "U1.8",
          x: 0.6000000000000001,
          y: 0.30000000000000004,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "R1.1"],
      netId: "chip.U1 > port.pin1 to R1.1",
    },
    {
      pinIds: ["U1.6", "R1.2"],
      netId: "chip.U1 > port.pin6 to R1.2",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
