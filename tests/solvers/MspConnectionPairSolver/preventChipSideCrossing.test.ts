import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"

test("MspConnectionPairSolver should prevent connections across chip sides", () => {
  const input = {
    inputProblem: {
      chips: [
        {
          chipId: "schematic_component_0",
          center: {
            x: 0,
            y: 0,
          },
          width: 2,
          height: 1.4,
          pins: [
            {
              pinId: "U3.8",
              x: -1.4,
              y: 0.42500000000000004,
            },
            {
              pinId: "U3.4",
              x: -1.4,
              y: -0.42500000000000004,
            },
            {
              pinId: "U3.1",
              x: 1.4,
              y: 0.5,
            },
            {
              pinId: "U3.6",
              x: 1.4,
              y: 0.30000000000000004,
            },
            {
              pinId: "U3.5",
              x: 1.4,
              y: 0.10000000000000009,
            },
            {
              pinId: "U3.2",
              x: 1.4,
              y: -0.09999999999999998,
            },
            {
              pinId: "U3.3",
              x: 1.4,
              y: -0.3,
            },
            {
              pinId: "U3.7",
              x: 1.4,
              y: -0.5,
            },
          ],
        },
        {
          chipId: "schematic_component_1",
          center: {
            x: -2.3145833,
            y: 0,
          },
          width: 0.5291665999999999,
          height: 1.0583333000000001,
          pins: [
            {
              pinId: "C20.1",
              x: -2.3148566499999994,
              y: 0.5512093000000002,
            },
            {
              pinId: "C20.2",
              x: -2.31430995,
              y: -0.5512093000000002,
            },
          ],
        },
        {
          chipId: "schematic_component_2",
          center: {
            x: 1.7577928249999983,
            y: 1.7512907000000002,
          },
          width: 0.3155856499999966,
          height: 1.0583332999999997,
          pins: [
            {
              pinId: "R11.1",
              x: 1.7580660749999977,
              y: 2.3025814000000002,
            },
            {
              pinId: "R11.2",
              x: 1.757519574999999,
              y: 1.2,
            },
          ],
        },
      ],
      directConnections: [
        {
          pinIds: ["C20.1", "U3.8"],
          netId: "capacitor.C20 > port.pin1 to .U3 > .VDD",
        },
        {
          pinIds: ["C20.2", "U3.4"],
          netId: "capacitor.C20 > port.pin2 to .U3 > .GND",
        },
        {
          pinIds: ["R11.2", "U3.1"],
          netId: "resistor.R11 > port.pin2 to .U3 > .N_CS",
        },
      ],
      netConnections: [
        {
          netId: "V3_3",
          pinIds: ["U3.8", "U3.3", "U3.7", "C20.1", "R11.1"],
        },
        {
          netId: "GND",
          pinIds: ["U3.4", "C20.2"],
        },
        {
          netId: "FLASH_N_CS",
          pinIds: ["U3.1", "R11.2"],
        },
      ],
      availableNetLabelOrientations: {
        V3_3: ["y+"],
        GND: ["y-"],
      },
      maxMspPairDistance: 5,
    },
  }

  const solver = new MspConnectionPairSolver(input as any)
  solver.solve()

  // Check that no connections cross chip sides
  for (const pair of solver.mspConnectionPairs) {
    const [pin1, pin2] = pair.pins

    // If both pins are on the same chip (schematic_component_0), check they don't cross sides
    if (
      pin1.chipId === pin2.chipId &&
      pin1.chipId === "schematic_component_0"
    ) {
      // U3.8 is on left side (x = -1.4), U3.3 and U3.7 are on right side (x = 1.4)
      // These should not be directly connected
      const leftSidePins = ["U3.8", "U3.4"]
      const rightSidePins = ["U3.1", "U3.6", "U3.5", "U3.2", "U3.3", "U3.7"]

      const pin1IsLeft = leftSidePins.includes(pin1.pinId)
      const pin2IsLeft = leftSidePins.includes(pin2.pinId)
      const pin1IsRight = rightSidePins.includes(pin1.pinId)
      const pin2IsRight = rightSidePins.includes(pin2.pinId)

      // Should not connect left side to right side
      const connectsLeftToRight =
        (pin1IsLeft && pin2IsRight) || (pin1IsRight && pin2IsLeft)

      expect(connectsLeftToRight).toBe(false)
    }
  }

  // Specifically check that U3.8 is not directly connected to U3.3 or U3.7
  const problematicConnections = solver.mspConnectionPairs.filter((pair) => {
    const pinIds = [pair.pins[0].pinId, pair.pins[1].pinId]
    return (
      (pinIds.includes("U3.8") && pinIds.includes("U3.3")) ||
      (pinIds.includes("U3.8") && pinIds.includes("U3.7"))
    )
  })

  expect(problematicConnections).toHaveLength(0)
})
