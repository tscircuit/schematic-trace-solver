import { PipelineDebugger } from "site/components/PipelineDebugger"
import type { InputProblem } from "lib/types/InputProblem"
const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: {
        x: -1.9145832999999999,
        y: 0.5512093000000002,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C6.1",
          x: -1.9148566499999995,
          y: 1.1024186000000005,
        },
        {
          pinId: "C6.2",
          x: -1.9143099500000003,
          y: 0,
        },
      ],
    },
    {
      chipId: "schematic_component_1",
      center: {
        x: -4.1729164999999995,
        y: 0.5512093,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C1.1",
          x: -4.173189849999999,
          y: 1.1024186000000002,
        },
        {
          pinId: "C1.2",
          x: -4.17264315,
          y: -2.220446049250313e-16,
        },
      ],
    },
    {
      chipId: "schematic_component_2",
      center: {
        x: -3.0437499,
        y: 0.5512093,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C2.1",
          x: -3.0440232499999995,
          y: 1.1024186000000002,
        },
        {
          pinId: "C2.2",
          x: -3.0434765500000003,
          y: -2.220446049250313e-16,
        },
      ],
    },
    {
      chipId: "schematic_component_3",
      center: {
        x: 1.9145832999999999,
        y: -0.4512093000000006,
      },
      width: 0.5291665999999999,
      height: 1.0583333000000001,
      pins: [
        {
          pinId: "C5.1",
          x: 1.9143099500000003,
          y: 0.09999999999999964,
        },
        {
          pinId: "C5.2",
          x: 1.9148566499999995,
          y: -1.0024186000000008,
        },
      ],
    },
    {
      chipId: "schematic_component_4",
      center: {
        x: 0,
        y: 0,
      },
      width: 1.2000000000000002,
      height: 0.8,
      pins: [
        {
          pinId: "U1.1",
          x: -1,
          y: 0.2,
        },
        {
          pinId: "U1.2",
          x: -1,
          y: 0,
        },
        {
          pinId: "U1.3",
          x: -1,
          y: -0.2,
        },
        {
          pinId: "U1.4",
          x: 1,
          y: -0.1,
        },
        {
          pinId: "U1.5",
          x: 1,
          y: 0.1,
        },
      ],
    },
  ],
  directConnections: [
    {
      pinIds: ["U1.1", "C6.1"],
      netId: "group.voltage_regulator > chip.U1 > port.VIN to C6.1",
    },
    {
      pinIds: ["U1.1", "C1.1"],
      netId: "group.voltage_regulator > chip.U1 > port.VIN to C1.1",
    },
    {
      pinIds: ["U1.1", "C2.1"],
      netId: "group.voltage_regulator > chip.U1 > port.VIN to C2.1",
    },
    {
      pinIds: ["U1.2", "C6.2"],
      netId: "group.voltage_regulator > chip.U1 > port.GND to C6.2",
    },
    {
      pinIds: ["U1.2", "C1.2"],
      netId: "group.voltage_regulator > chip.U1 > port.GND to C1.2",
    },
    {
      pinIds: ["U1.2", "C2.2"],
      netId: "group.voltage_regulator > chip.U1 > port.GND to C2.2",
    },
    {
      pinIds: ["U1.3", "U1.1"],
      netId: "group.voltage_regulator > chip.U1 > port.EN to U1.1",
    },
    {
      pinIds: ["U1.5", "C5.1"],
      netId: "group.voltage_regulator > chip.U1 > port.VOUT to C5.1",
    },
  ],
  netConnections: [
    {
      netId: "VSYS",
      pinIds: ["C6.1", "C1.1", "C2.1", "U1.1", "U1.3"],
    },
    {
      netId: "GND",
      pinIds: ["C6.2", "C1.2", "C2.2", "C5.2", "U1.2"],
    },
    {
      netId: "V3_3",
      pinIds: ["C5.1", "U1.5"],
    },
  ],
  availableNetLabelOrientations: {
    VSYS: ["y+"],
    GND: ["y-"],
    V3_3: ["y+"],
  },
}

export default () => <PipelineDebugger inputProblem={inputProblem} />
