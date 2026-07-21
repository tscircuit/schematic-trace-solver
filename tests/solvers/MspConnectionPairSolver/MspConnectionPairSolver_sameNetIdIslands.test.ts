import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("separate directConnections with the same netId stay isolated", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "GND" },
      { pinIds: ["U2.1", "C2.1"], netId: "GND" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
  }

  const { directConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  expect(directConnMap.areIdsConnected("U1.1", "C1.1")).toBe(true)
  expect(directConnMap.areIdsConnected("U2.1", "C2.1")).toBe(true)
  expect(directConnMap.areIdsConnected("U1.1", "U2.1")).toBe(false)
  expect(directConnMap.areIdsConnected("C1.1", "C2.1")).toBe(false)
})

test("separate netConnections with the same netId stay isolated unless they share a pin", () => {
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      { pinIds: ["A", "B"], netId: "BUS" },
      { pinIds: ["C", "D"], netId: "BUS" },
      { pinIds: ["D", "E"], netId: "BUS" },
    ],
    availableNetLabelOrientations: {},
  }

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  expect(netConnMap.areIdsConnected("A", "B")).toBe(true)
  expect(netConnMap.areIdsConnected("C", "D")).toBe(true)
  expect(netConnMap.areIdsConnected("D", "E")).toBe(true)
  expect(netConnMap.areIdsConnected("C", "E")).toBe(true)
  expect(netConnMap.areIdsConnected("A", "C")).toBe(false)
})

test("MspConnectionPairSolver does not create cross-island pairs for reused net names", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U1.1", x: 0, y: 0 }],
      },
      {
        chipId: "C1",
        center: { x: 0, y: 1 },
        width: 1,
        height: 1,
        pins: [{ pinId: "C1.1", x: 0, y: 1 }],
      },
      {
        chipId: "U2",
        center: { x: 3, y: 0 },
        width: 1,
        height: 1,
        pins: [{ pinId: "U2.1", x: 3, y: 0 }],
      },
      {
        chipId: "C2",
        center: { x: 3, y: 1 },
        width: 1,
        height: 1,
        pins: [{ pinId: "C2.1", x: 3, y: 1 }],
      },
    ],
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "GND" },
      { pinIds: ["U2.1", "C2.1"], netId: "GND" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const solver = new MspConnectionPairSolver({ inputProblem })
  solver.solve()

  expect(solver.mspConnectionPairs).toHaveLength(2)
  expect(
    solver.mspConnectionPairs.every((pair) => {
      const pinIds = pair.pins.map((pin) => pin.pinId).sort()
      return (
        pinIds.join(",") === "C1.1,U1.1" || pinIds.join(",") === "C2.1,U2.1"
      )
    }),
  ).toBe(true)
})
