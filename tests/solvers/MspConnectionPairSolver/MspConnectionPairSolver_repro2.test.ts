import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { test, expect } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

test("MspConnectionPairSolver should solve problem correctly", () => {
  const input = {
    inputProblem: {
      chips: [
        {
          chipId: "schematic_component_0",
          center: {
            x: -2,
            y: 0,
          },
          width: 0.8122621299999988,
          height: 1.1038501999999986,
          pins: [
            {
              pinId: "Q1_NPN.1",
              x: -2.2855604555,
              y: -0.5519250999999993,
            },
            {
              pinId: "Q1_NPN.2",
              x: -2.2855604555000015,
              y: 0.5519250999999993,
            },
            {
              pinId: "Q1_NPN.3",
              x: -1.5938689350000006,
              y: 0.004526300000001031,
            },
          ],
        },
        {
          chipId: "schematic_component_1",
          center: {
            x: 3.5,
            y: 0,
          },
          width: 0.8122621299999988,
          height: 1.1038501999999986,
          pins: [
            {
              pinId: "Q2_PNP.1",
              x: 3.2144395445,
              y: -0.5519250999999993,
            },
            {
              pinId: "Q2_PNP.2",
              x: 3.2144395444999985,
              y: 0.5519250999999993,
            },
            {
              pinId: "Q2_PNP.3",
              x: 3.9061310649999994,
              y: 0.004526300000001031,
            },
          ],
        },
      ],
      directConnections: [],
      netConnections: [
        {
          netId: "collector",
          pinIds: ["Q1_NPN.1", "Q2_PNP.1"],
        },
        {
          netId: "emitter",
          pinIds: ["Q1_NPN.2", "Q2_PNP.2"],
        },
        {
          netId: "base",
          pinIds: ["Q1_NPN.3", "Q2_PNP.3"],
        },
      ],
      availableNetLabelOrientations: {},
      maxMspPairDistance: 2,
    },
  }

  const solver = new MspConnectionPairSolver(input as any)
  solver.solve()

  for (const { pins } of solver.mspConnectionPairs) {
    const [pin1, pin2] = pins
    const dist = Math.sqrt((pin1.x - pin2.x) ** 2 + (pin1.y - pin2.y) ** 2)
    expect(dist).toBeLessThan(input.inputProblem.maxMspPairDistance)
  }

  // Add more specific assertions based on expected output
  // expect(solver.netLabelPlacementSolver!.netLabelPlacements).toMatchInlineSnapshot()
})

const netLabelOnlyInput: InputProblem = {
  chips: [
    {
      chipId: "schematic_component_0",
      center: { x: -1, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "C1.1", x: -0.5, y: 0 }],
    },
    {
      chipId: "schematic_component_1",
      center: { x: 1, y: 0 },
      width: 1,
      height: 1,
      pins: [{ pinId: "C2.1", x: 0.5, y: 0 }],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "GND", pinIds: ["C1.1", "C2.1"] }],
  availableNetLabelOrientations: {},
  maxMspPairDistance: 10,
}

test("net-label-only connections do not mutate the direct connectivity map", () => {
  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(netLabelOnlyInput)
  const netOnlyMapId = Object.keys(netConnMap.netMap)[0]!

  expect(Object.keys(directConnMap.netMap)).toHaveLength(0)
  expect(netConnMap.getIdsConnectedToNet(netOnlyMapId)).toEqual([
    "GND",
    "C1.1",
    "C2.1",
  ])
})

test("MspConnectionPairSolver does not route net-label-only connections", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: netLabelOnlyInput,
  })

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(0)
})

test("MspConnectionPairSolver skips nets that have no directly wired pins", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "schematic_component_0",
        center: { x: -1, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "A1", x: -0.5, y: 0 }],
      },
      {
        chipId: "schematic_component_1",
        center: { x: 1, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "A2", x: 0.5, y: 0 }],
      },
      {
        chipId: "schematic_component_2",
        center: { x: -1, y: 2 },
        width: 1,
        height: 1,
        pins: [{ pinId: "B1", x: -0.5, y: 2 }],
      },
      {
        chipId: "schematic_component_3",
        center: { x: 1, y: 2 },
        width: 1,
        height: 1,
        pins: [{ pinId: "B2", x: 0.5, y: 2 }],
      },
    ],
    directConnections: [{ netId: "SIG", pinIds: ["A1", "A2"] }],
    netConnections: [{ netId: "GND", pinIds: ["B1", "B2"] }],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })

  expect(solver.queuedDcNetIds).toHaveLength(1)

  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(1)
})
