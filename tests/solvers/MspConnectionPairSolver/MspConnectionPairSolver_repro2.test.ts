import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { test, expect } from "bun:test"

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
