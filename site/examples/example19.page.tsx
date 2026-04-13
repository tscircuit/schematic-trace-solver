import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 0.4,
      height: 0.8,
      pins: [
        {
          pinId: "U1.6",
          x: 0.6000000000000001,
          y: -0.2,
        },
        {
          pinId: "U1.8",
          x: 0.6000000000000001,
          y: 0,
        },
        {
          pinId: "U1.1",
          x: 0.6000000000000001,
          y: 0.2,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: 1.4,
        y: 0.55,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C2.1",
          x: 1.4002733499999995,
          y: -0.0012093000000001908,
        },
        {
          pinId: "C2.2",
          x: 1.3997266500000003,
          y: 1.1012093000000003,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: 2.7,
        y: 1.3,
      },
      width: 1.0583332999999997,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R1.1",
          x: 2.1487093,
          y: 1.3002732499999994,
        },
        {
          pinId: "R1.2",
          x: 3.2512907000000006,
          y: 1.2997267500000007,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 4.4,
        y: 0,
      },
      width: 0.4,
      height: 0.4,
      pins: [
        {
          pinId: "JP5.1",
          x: 3.8000000000000003,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 4.4,
        y: -0.9,
      },
      width: 0.4,
      height: 0.4,
      pins: [
        {
          pinId: "JP9.1",
          x: 3.8000000000000003,
          y: -0.9,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 2,
        y: -1.1,
      },
      width: 0.8843008999999997,
      height: 0.5299361999999987,
      pins: [
        {
          pinId: "JP8.1",
          x: 2.4458007999999998,
          y: -1.2015872704999997,
        },
        {
          pinId: "JP8.2",
          x: 2.0034928,
          y: -0.8474009705000005,
        },
        {
          pinId: "JP8.3",
          x: 1.5541992,
          y: -1.2014628704999997,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["C2.1", "U1.8"],
      netId: "capacitor.C2 > port.pin1 to .U1 > .pin8",
    },
    {
      pinIds: ["C2.2", "R1.1"],
      netId: "capacitor.C2 > port.pin2 to .R1 > .pin1",
    },
    {
      pinIds: ["R1.1", "U1.1"],
      netId: "resistor.R1 > port.pin1 to .U1 > .pin1",
    },
    {
      pinIds: ["JP5.1", "R1.2"],
      netId: "pinheader.JP5 > port.pin1 to .R1 > .pin2",
    },
    {
      pinIds: ["JP9.1", "R1.2"],
      netId: "pinheader.JP9 > port.pin1 to .R1 > .pin2",
    },
    {
      pinIds: ["JP8.2", "U1.6"],
      netId: "solderjumper.JP8 > port.pin2 to .U1 > .pin6",
    },
  ],
  netConnections: [
    {
      netId: "PAD",
      pinIds: ["R1.2", "JP5.1", "JP9.1"],
    },
  ],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
