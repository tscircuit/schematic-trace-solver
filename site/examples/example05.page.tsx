import type { InputProblem } from "lib/index"
import { PipelineDebugger } from "site/components/PipelineDebugger"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 1,
      height: 5,
      pins: [
        {
          pinId: "U1.1",
          x: 0.9,
          y: 1.2,
        },
        {
          pinId: "U1.2",
          x: 0.9,
          y: 0.3999999999999999,
        },
        {
          pinId: "U1.3",
          x: 0.9,
          y: 0.5999999999999999,
        },
        {
          pinId: "U1.4",
          x: -0.9,
          y: 0.3999999999999999,
        },
        {
          pinId: "U1.5",
          x: 0.9,
          y: 0.9999999999999998,
        },
        {
          pinId: "U1.6",
          x: 0.9,
          y: -0.19999999999999996,
        },
        {
          pinId: "U1.7",
          x: -0.9,
          y: -0.7999999999999998,
        },
        {
          pinId: "U1.9",
          x: 0.9,
          y: 0.19999999999999996,
        },
        {
          pinId: "U1.10",
          x: 0.9,
          y: 0,
        },
        {
          pinId: "U1.11",
          x: 0.9,
          y: 0.7999999999999998,
        },
        {
          pinId: "U1.12",
          x: 0.9,
          y: -1.2,
        },
        {
          pinId: "U1.13",
          x: 0.9,
          y: -1,
        },
        {
          pinId: "U1.14",
          x: 0.9,
          y: -0.7999999999999999,
        },
        {
          pinId: "U1.15",
          x: -0.9,
          y: 1,
        },
        {
          pinId: "U1.16",
          x: -0.9,
          y: 1.2,
        },
        {
          pinId: "U1.17",
          x: -0.9,
          y: 0.5999999999999999,
        },
        {
          pinId: "U1.18",
          x: -0.9,
          y: -0.9999999999999998,
        },
        {
          pinId: "U1.19",
          x: -0.9,
          y: -0.19999999999999996,
        },
        {
          pinId: "U1.20",
          x: -0.9,
          y: 0.7999999999999999,
        },
        {
          pinId: "U1.21",
          x: -0.9,
          y: -1.2,
        },
        {
          pinId: "U1.22",
          x: 0.9,
          y: -0.5999999999999999,
        },
        {
          pinId: "U1.23",
          x: 0.9,
          y: -0.3999999999999999,
        },
        {
          pinId: "U1.25",
          x: -0.9,
          y: -0.5999999999999999,
        },
        {
          pinId: "U1.26",
          x: -0.9,
          y: -0.3999999999999999,
        },
        {
          pinId: "U1.27",
          x: -0.9,
          y: 0.19999999999999996,
        },
        {
          pinId: "U1.28",
          x: -0.9,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 2,
        y: 1,
      },
      width: 1.0402490999999996,
      height: 0.5476905999999993,
      pins: [
        {
          pinId: "LED1.1",
          x: 1.4808529,
          y: 1.0005122999999987,
        },
        {
          pinId: "LED1.2",
          x: 2.5191471,
          y: 0.9994877000000013,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["LED1.2", "U1.20"],
      netId: ".LED1 > port.right to .U1 > .pin20",
    },
  ],
  netConnections: [],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 2,
}

export default function Example05Page() {
  return <PipelineDebugger inputProblem={inputProblem} />
}
