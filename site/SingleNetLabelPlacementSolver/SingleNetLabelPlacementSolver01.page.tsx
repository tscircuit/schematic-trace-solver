import { useMemo } from "react"
import { GenericSolverDebugger } from "../components/GenericSolverDebugger"
import { SingleNetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"

export const input = {
  inputProblem: {
    chips: [
      {
        chipId: "schematic_component_0",
        center: {
          x: 0,
          y: 0,
        },
        width: 2.4000000000000004,
        height: 1,
        pins: [
          {
            pinId: "U1.1",
            x: 1.2000000000000002,
            y: -0.30000000000000004,
          },
          {
            pinId: "U1.2",
            x: -1.2000000000000002,
            y: -0.30000000000000004,
          },
          {
            pinId: "U1.3",
            x: 1.2000000000000002,
            y: 0.09999999999999998,
          },
          {
            pinId: "U1.4",
            x: -1.2000000000000002,
            y: 0.30000000000000004,
          },
          {
            pinId: "U1.5",
            x: -1.2000000000000002,
            y: 0.10000000000000003,
          },
          {
            pinId: "U1.6",
            x: -1.2000000000000002,
            y: -0.09999999999999998,
          },
          {
            pinId: "U1.7",
            x: 1.2000000000000002,
            y: -0.10000000000000003,
          },
          {
            pinId: "U1.8",
            x: 1.2000000000000002,
            y: 0.30000000000000004,
          },
        ],
      },
      {
        chipId: "schematic_component_1",
        center: {
          x: 2.45,
          y: -0.10000000000000009,
        },
        width: 1.0999999999999996,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R1.1",
            x: 3,
            y: -0.10000000000000016,
          },
          {
            pinId: "R1.2",
            x: 1.9000000000000004,
            y: -0.10000000000000002,
          },
        ],
      },
      {
        chipId: "schematic_component_2",
        center: {
          x: 0.6500000000000001,
          y: -1.2944553500000002,
        },
        width: 1.1,
        height: 0.388910699999999,
        pins: [
          {
            pinId: "R2.1",
            x: 1.2000000000000002,
            y: -1.2944553500000002,
          },
          {
            pinId: "R2.2",
            x: 0.10000000000000009,
            y: -1.2944553500000002,
          },
        ],
      },
      {
        chipId: "schematic_component_3",
        center: {
          x: -1.2000000000000002,
          y: -1.7000000000000002,
        },
        width: 1.06,
        height: 1.1,
        pins: [
          {
            pinId: "C1.1",
            x: -1.2000000000000002,
            y: -1.1500000000000001,
          },
          {
            pinId: "C1.2",
            x: -1.2000000000000002,
            y: -2.25,
          },
        ],
      },
      {
        chipId: "schematic_component_4",
        center: {
          x: -2.45,
          y: 0.10000000000000009,
        },
        width: 1.0999999999999996,
        height: 0.84,
        pins: [
          {
            pinId: "C2.1",
            x: -1.9000000000000004,
            y: 0.10000000000000002,
          },
          {
            pinId: "C2.2",
            x: -3,
            y: 0.10000000000000016,
          },
        ],
      },
      {
        chipId: "schematic_component_5",
        center: {
          x: 1.2000000000000002,
          y: 1.7000000000000002,
        },
        width: 1.06,
        height: 1.1,
        pins: [
          {
            pinId: "R3.1",
            x: 1.2000000000000002,
            y: 1.1500000000000001,
          },
          {
            pinId: "R3.2",
            x: 1.2000000000000002,
            y: 2.25,
          },
        ],
      },
    ],
    directConnections: [
      {
        pinIds: ["U1.5", "C2.1"],
        netId: "U1.CTRL to C2.pin1",
      },
      {
        pinIds: ["U1.6", "U1.2"],
        netId: "U1.THRES to U1.TRIG",
      },
      {
        pinIds: ["R1.2", "U1.7"],
        netId: "R1.pin2 to U1.DISCH",
      },
      {
        pinIds: ["U1.7", "R2.1"],
        netId: "U1.DISCH to R2.pin1",
      },
      {
        pinIds: ["R2.2", "U1.6"],
        netId: "R2.pin2 to U1.THRES",
      },
      {
        pinIds: ["U1.6", "C1.1"],
        netId: "U1.THRES to C1.pin1",
      },
      {
        pinIds: ["U1.3", "R3.1"],
        netId: "U1.OUT to R3.pin1",
      },
    ],
    netConnections: [
      {
        netId: "GND",
        pinIds: ["U1.1", "C1.2", "C2.2"],
      },
      {
        netId: "VCC",
        pinIds: ["U1.4", "U1.8", "R1.1"],
      },
    ],
    availableNetLabelOrientations: {
      VCC: ["y+"],
      GND: ["y-"],
    },
    maxMspPairDistance: 2.4,
  },
  inputTraceMap: {
    "U1.5-C2.1": {
      mspPairId: "U1.5-C2.1",
      dcConnNetId: "connectivity_net0",
      globalConnNetId: "connectivity_net0",
      userNetId: "U1.CTRL to C2.pin1",
      pins: [
        {
          pinId: "U1.5",
          x: -1.2000000000000002,
          y: 0.10000000000000003,
          chipId: "schematic_component_0",
        },
        {
          pinId: "C2.1",
          x: -1.9000000000000004,
          y: 0.10000000000000002,
          chipId: "schematic_component_4",
        },
      ],
      tracePath: [
        {
          x: -1.2000000000000002,
          y: 0.10000000000000003,
        },
        {
          x: -1.4000000000000001,
          y: 0.10000000000000003,
        },
        {
          x: -1.5500000000000003,
          y: 0.10000000000000003,
        },
        {
          x: -1.5500000000000003,
          y: 0.10000000000000002,
        },
        {
          x: -1.7000000000000004,
          y: 0.10000000000000002,
        },
        {
          x: -1.9000000000000004,
          y: 0.10000000000000002,
        },
      ],
      mspConnectionPairIds: ["U1.5-C2.1"],
      pinIds: ["U1.5", "C2.1"],
    },
    "U1.2-C1.1": {
      mspPairId: "U1.2-C1.1",
      dcConnNetId: "connectivity_net1",
      globalConnNetId: "connectivity_net1",
      userNetId: "U1.THRES to U1.TRIG",
      pins: [
        {
          pinId: "U1.2",
          x: -1.2000000000000002,
          y: -0.30000000000000004,
          chipId: "schematic_component_0",
        },
        {
          pinId: "C1.1",
          x: -1.2000000000000002,
          y: -1.1500000000000001,
          chipId: "schematic_component_3",
        },
      ],
      tracePath: [
        {
          x: -1.2000000000000002,
          y: -0.30000000000000004,
        },
        {
          x: -1.4000000000000001,
          y: -0.30000000000000004,
        },
        {
          x: -1.4000000000000001,
          y: -0.7250000000000001,
        },
        {
          x: -1.2000000000000002,
          y: -0.7250000000000001,
        },
        {
          x: -1.2000000000000002,
          y: -1.1500000000000001,
        },
      ],
      mspConnectionPairIds: ["U1.2-C1.1"],
      pinIds: ["U1.2", "C1.1"],
    },
    "U1.6-U1.2": {
      mspPairId: "U1.6-U1.2",
      dcConnNetId: "connectivity_net1",
      globalConnNetId: "connectivity_net1",
      userNetId: "U1.THRES to C1.pin1",
      pins: [
        {
          pinId: "U1.6",
          x: -1.2000000000000002,
          y: -0.09999999999999998,
          chipId: "schematic_component_0",
        },
        {
          pinId: "U1.2",
          x: -1.2000000000000002,
          y: -0.30000000000000004,
          chipId: "schematic_component_0",
        },
      ],
      tracePath: [
        {
          x: -1.2000000000000002,
          y: -0.09999999999999998,
        },
        {
          x: -1.4000000000000001,
          y: -0.09999999999999998,
        },
        {
          x: -1.4000000000000001,
          y: -0.30000000000000004,
        },
        {
          x: -1.2000000000000002,
          y: -0.30000000000000004,
        },
      ],
      mspConnectionPairIds: ["U1.6-U1.2"],
      pinIds: ["U1.6", "U1.2"],
    },
    "R2.2-C1.1": {
      mspPairId: "R2.2-C1.1",
      dcConnNetId: "connectivity_net1",
      globalConnNetId: "connectivity_net1",
      userNetId: "R2.pin2 to U1.THRES",
      pins: [
        {
          pinId: "R2.2",
          x: 0.10000000000000009,
          y: -1.2944553500000002,
          chipId: "schematic_component_2",
        },
        {
          pinId: "C1.1",
          x: -1.2000000000000002,
          y: -1.1500000000000001,
          chipId: "schematic_component_3",
        },
      ],
      tracePath: [
        {
          x: 0.09999999999999987,
          y: -1.2944553500000002,
        },
        {
          x: -0.55,
          y: -1.2944553500000002,
        },
        {
          x: -0.55,
          y: -0.9500000000000002,
        },
        {
          x: -1.2000000000000002,
          y: -0.9500000000000002,
        },
        {
          x: -1.2000000000000002,
          y: -1.1500000000000001,
        },
      ],
      mspConnectionPairIds: ["R2.2-C1.1"],
      pinIds: ["R2.2", "C1.1"],
    },
    "U1.7-R1.2": {
      mspPairId: "U1.7-R1.2",
      dcConnNetId: "connectivity_net2",
      globalConnNetId: "connectivity_net2",
      userNetId: "U1.DISCH to R2.pin1",
      pins: [
        {
          pinId: "U1.7",
          x: 1.2000000000000002,
          y: -0.10000000000000003,
          chipId: "schematic_component_0",
        },
        {
          pinId: "R1.2",
          x: 1.9000000000000004,
          y: -0.10000000000000002,
          chipId: "schematic_component_1",
        },
      ],
      tracePath: [
        {
          x: 1.2000000000000002,
          y: -0.10000000000000003,
        },
        {
          x: 1.4000000000000001,
          y: -0.10000000000000003,
        },
        {
          x: 1.5500000000000003,
          y: -0.10000000000000003,
        },
        {
          x: 1.5500000000000003,
          y: -0.10000000000000002,
        },
        {
          x: 1.7000000000000004,
          y: -0.10000000000000002,
        },
        {
          x: 1.9000000000000004,
          y: -0.10000000000000002,
        },
      ],
      mspConnectionPairIds: ["U1.7-R1.2"],
      pinIds: ["U1.7", "R1.2"],
    },
    "R2.1-U1.7": {
      mspPairId: "R2.1-U1.7",
      dcConnNetId: "connectivity_net2",
      globalConnNetId: "connectivity_net2",
      userNetId: "U1.DISCH to R2.pin1",
      pins: [
        {
          pinId: "R2.1",
          x: 1.2000000000000002,
          y: -1.2944553500000002,
          chipId: "schematic_component_2",
        },
        {
          pinId: "U1.7",
          x: 1.2000000000000002,
          y: -0.10000000000000003,
          chipId: "schematic_component_0",
        },
      ],
      tracePath: [
        {
          x: 1.2000000000000002,
          y: -1.2944553500000002,
        },
        {
          x: 1.4000000000000001,
          y: -1.2944553500000002,
        },
        {
          x: 1.4000000000000001,
          y: -0.10000000000000003,
        },
        {
          x: 1.2000000000000002,
          y: -0.10000000000000003,
        },
      ],
      mspConnectionPairIds: ["R2.1-U1.7"],
      pinIds: ["R2.1", "U1.7"],
    },
    "U1.3-R3.1": {
      mspPairId: "U1.3-R3.1",
      dcConnNetId: "connectivity_net3",
      globalConnNetId: "connectivity_net3",
      userNetId: "U1.OUT to R3.pin1",
      pins: [
        {
          pinId: "U1.3",
          x: 1.2000000000000002,
          y: 0.09999999999999998,
          chipId: "schematic_component_0",
        },
        {
          pinId: "R3.1",
          x: 1.2000000000000002,
          y: 1.1500000000000001,
          chipId: "schematic_component_5",
        },
      ],
      tracePath: [
        {
          x: 1.2000000000000002,
          y: 0.09999999999999998,
        },
        {
          x: 1.4000000000000001,
          y: 0.09999999999999998,
        },
        {
          x: 1.4000000000000001,
          y: 0.625,
        },
        {
          x: 1.2000000000000002,
          y: 0.625,
        },
        {
          x: 1.2000000000000002,
          y: 1.1500000000000001,
        },
      ],
      mspConnectionPairIds: ["U1.3-R3.1"],
      pinIds: ["U1.3", "R3.1"],
    },
    "U1.8-R1.1": {
      mspPairId: "U1.8-R1.1",
      dcConnNetId: "connectivity_net5",
      globalConnNetId: "connectivity_net5",
      userNetId: "VCC",
      pins: [
        {
          pinId: "U1.8",
          x: 1.2000000000000002,
          y: 0.30000000000000004,
          chipId: "schematic_component_0",
        },
        {
          pinId: "R1.1",
          x: 3,
          y: -0.10000000000000016,
          chipId: "schematic_component_1",
        },
      ],
      tracePath: [
        {
          x: 1.2000000000000002,
          y: 0.30000000000000004,
        },
        {
          x: 3.2,
          y: 0.30000000000000004,
        },
        {
          x: 3.2,
          y: -0.10000000000000016,
        },
        {
          x: 3,
          y: -0.10000000000000016,
        },
      ],
      mspConnectionPairIds: ["U1.8-R1.1"],
      pinIds: ["U1.8", "R1.1"],
    },
  },
  overlappingSameNetTraceGroup: {
    globalConnNetId: "connectivity_net4",
    netId: "GND",
    portOnlyPinId: "U1.1",
  },
  availableOrientations: ["y-"],
}

export default () => {
  const solver = useMemo(() => {
    return new SingleNetLabelPlacementSolver(input as any)
  }, [])
  return <GenericSolverDebugger solver={solver} />
}
