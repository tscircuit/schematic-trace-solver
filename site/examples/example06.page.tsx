import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -3,
        y: 0,
      },
      width: 1.102581400000001,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: -3.5512907000000005,
          y: 0.0002732499999993365,
        },
        {
          pinId: "R1.2",
          x: -2.4487092999999995,
          y: -0.0002732499999993365,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 3,
        y: 0,
      },
      width: 1.102418600000001,
      height: 0.8400173000000031,
      pins: [
        {
          pinId: "C1.1",
          x: 2.4487906999999995,
          y: -0.00027334999999961695,
        },
        {
          pinId: "C1.2",
          x: 3.5512093000000005,
          y: 0.00027334999999961695,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["R1.1", "C1.1"],
      netId: ".R1 > .pin1 to .C1 > .pin1",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
