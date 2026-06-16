import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

// Reproduces the scenario from tscircuit/core repro61: two capacitors with
// only net connections (GND, VCC) and no direct connections. Per the README,
// "Net connections will not be routed, net labels are placed instead."
// The solver must not produce MSP pairs (and therefore wire traces) for
// net-label-only nets.
const buildInputProblem = (): InputProblem => ({
  chips: [
    {
      chipId: "C1",
      center: { x: 0.5, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 0.5, y: 0.4 },
        { pinId: "C1.2", x: 0.5, y: -0.4 },
      ],
    },
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 0, y: 0.4 },
        { pinId: "C2.2", x: 0, y: -0.4 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"] },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"],
  },
})

test("MspConnectionPairSolver should not create pairs for net-label-only connections", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: buildInputProblem(),
  })
  solver.solve()

  expect(solver.mspConnectionPairs.length).toBe(0)
})

test("getConnectivityMapsFromInputProblem should not leak net connections into directConnMap", () => {
  // The directConnMap must only contain entries from directConnections.
  // A previous bug shared the netMap reference between the two maps, causing
  // netConnections to mutate directConnMap.
  const { directConnMap } = getConnectivityMapsFromInputProblem(
    buildInputProblem(),
  )

  expect(Object.keys(directConnMap.netMap)).toEqual([])
})
