import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: 0,
        y: 0,
      },
      width: 1.5,
      height: 3.75,
      pins: [
        {
          pinId: "PWR1.7",
          x: 1.15,
          y: 0.75,
        },
        {
          pinId: "PWR1.6",
          x: 1.15,
          y: 0,
        },
        {
          pinId: "PWR1.5",
          x: 1.15,
          y: -0.75,
        },
        {
          pinId: "PWR1.4",
          x: -1.15,
          y: -1.125,
        },
        {
          pinId: "PWR1.3",
          x: -1.15,
          y: -0.375,
        },
        {
          pinId: "PWR1.2",
          x: -1.15,
          y: 0.375,
        },
        {
          pinId: "PWR1.1",
          x: -1.15,
          y: 1.125,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -3,
        y: 0,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R6.1",
          x: -3.55,
          y: 0,
        },
        {
          pinId: "R6.2",
          x: -2.45,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -3,
        y: -2,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R7.1",
          x: -3.55,
          y: -1.9999999999999998,
        },
        {
          pinId: "R7.2",
          x: -2.45,
          y: -1.9999999999999998,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: -3,
        y: 2,
      },
      width: 1.06,
      height: 0.388910699999999,
      pins: [
        {
          pinId: "R8.1",
          x: -3.55,
          y: 2,
        },
        {
          pinId: "R8.2",
          x: -2.45,
          y: 2,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 3,
        y: -1.5,
      },
      width: 1.06,
      height: 0.84,
      pins: [
        {
          pinId: "C6.1",
          x: 2.45,
          y: -1.5,
        },
        {
          pinId: "C6.2",
          x: 3.55,
          y: -1.5,
        },
      ],
    },
    {
      chipId: "schematic_component_5",
      center: {
        x: 3,
        y: 0,
      },
      width: 1.06,
      height: 0.84,
      pins: [
        {
          pinId: "C7.1",
          x: 2.45,
          y: 0,
        },
        {
          pinId: "C7.2",
          x: 3.55,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_6",
      center: {
        x: 4,
        y: 3,
      },
      width: 1.13,
      height: 0.65,
      pins: [
        {
          pinId: "LED1.1",
          x: 3.46,
          y: 3,
        },
        {
          pinId: "LED1.2",
          x: 4.54,
          y: 3,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["R6.1", "PWR1.1"],
      netId: ".R6 > .pin1 to .PWR1 > .OUT",
    },
    {
      pinIds: ["LED1.1", "R8.2"],
      netId: ".LED1 > .pos to .R8 > .pin2",
    },
    {
      pinIds: ["PWR1.2", "R6.2"],
      netId: ".PWR1 > .FB to .R6 > .pin2",
    },
    {
      pinIds: ["PWR1.2", "R7.1"],
      netId: ".PWR1 > .FB to .R7 > .pin1",
    },
  ],
  netConnections: [
    {
      netId: "gnd",
      pinIds: ["PWR1.7", "PWR1.3", "R7.2", "C6.2", "C7.2", "LED1.2"],
    },
    {
      netId: "v5",
      pinIds: ["PWR1.6", "PWR1.4", "C6.1"],
    },
    {
      netId: "v3_3",
      pinIds: ["PWR1.1", "R6.1", "R8.1", "C7.1"],
    },
  ],
  availableNetLabelOrientations: {
    gnd: ["y-"],
    v5: ["y+"],
    v3_3: ["y+"],
  },
  maxMspPairDistance: 5,
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
