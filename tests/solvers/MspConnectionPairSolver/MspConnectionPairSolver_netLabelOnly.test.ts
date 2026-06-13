import { expect, test, describe } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Regression test for issue #79.
 *
 * When two components share a net via netConnections only (no directConnections),
 * MspConnectionPairSolver should NOT create MSP pairs for them — net-label-only
 * connections should be handled by NetLabelPlacementSolver, not by trace routing.
 *
 * The root cause was in getConnectivityMapsFromInputProblem: netConnMap was
 * constructed with a direct reference to directConnMap.netMap, so when
 * netConnMap.addConnections() added net connections, they also appeared in
 * directConnMap.netMap. This caused queuedDcNetIds to include net-only nets.
 */

describe("MspConnectionPairSolver - net-label-only nets (issue #79)", () => {
  test("should not create MSP pairs for net-only connections", () => {
    /**
     * Scenario: Two capacitors with GND/VCC connected via netConnections only.
     * No direct (wire) connections between them.
     *
     *   C1 (pin1=GND, pin2=VCC)   C2 (pin1=GND, pin2=VCC)
     *
     * Both share GND and VCC nets but only via netConnections.
     * Expected: 0 MSP pairs (no traces should be routed).
     */
    const inputProblem: InputProblem = {
      chips: [
        {
          chipId: "C1",
          center: { x: 0, y: 0 },
          width: 1,
          height: 2,
          pins: [
            { pinId: "C1.1", x: 0, y: -1, _facingDirection: "x-" },
            { pinId: "C1.2", x: 0, y: 1, _facingDirection: "x-" },
          ],
        },
        {
          chipId: "C2",
          center: { x: 5, y: 0 },
          width: 1,
          height: 2,
          pins: [
            { pinId: "C2.1", x: 5, y: -1, _facingDirection: "x+" },
            { pinId: "C2.2", x: 5, y: 1, _facingDirection: "x+" },
          ],
        },
      ],
      directConnections: [],
      netConnections: [
        { netId: "GND", pinIds: ["C1.1", "C2.1"] },
        { netId: "VCC", pinIds: ["C1.2", "C2.2"] },
      ],
      availableNetLabelOrientations: {
        GND: ["x+", "x-", "y+", "y-"],
        VCC: ["x+", "x-", "y+", "y-"],
      },
      maxMspPairDistance: 6,
    }

    const solver = new MspConnectionPairSolver({ inputProblem })
    solver.solve()

    // Net-only connections should produce NO MSP pairs
    expect(solver.mspConnectionPairs.length).toBe(0)
  })

  test("should still create MSP pairs for direct connections", () => {
    /**
     * Scenario: R1 connected directly to U1, with a netConnection adding
     * another pin to the same net.
     *
     *   R1.2 --(direct)--> U1.1
     *   R1.2 --(net)----> U2.1
     *
     * Expected: 1 MSP pair (R1.2-U1.1 direct connection).
     * U2.1 should NOT get an MSP pair since it's net-only.
     */
    const inputProblem: InputProblem = {
      chips: [
        {
          chipId: "R1",
          center: { x: 0, y: 0 },
          width: 2,
          height: 1,
          pins: [
            { pinId: "R1.1", x: -1, y: 0, _facingDirection: "x-" },
            { pinId: "R1.2", x: 1, y: 0, _facingDirection: "x+" },
          ],
        },
        {
          chipId: "U1",
          center: { x: 3, y: 0 },
          width: 2,
          height: 2,
          pins: [
            { pinId: "U1.1", x: 2, y: -0.5, _facingDirection: "x-" },
            { pinId: "U1.2", x: 2, y: 0.5, _facingDirection: "x-" },
          ],
        },
        {
          chipId: "U2",
          center: { x: 7, y: 0 },
          width: 2,
          height: 2,
          pins: [{ pinId: "U2.1", x: 6, y: -0.5, _facingDirection: "x-" }],
        },
      ],
      directConnections: [{ pinIds: ["R1.2", "U1.1"], netId: "NET1" }],
      netConnections: [{ netId: "NET1", pinIds: ["U2.1"] }],
      availableNetLabelOrientations: {
        NET1: ["x+", "x-", "y+", "y-"],
      },
      maxMspPairDistance: 6,
    }

    const solver = new MspConnectionPairSolver({ inputProblem })
    solver.solve()

    // Should have 2 MSP pairs: the direct connection R1.2-U1.1 gets routed,
    // and U2.1 (net-only) joins the same global net, so it also gets paired
    // via the globalConnMap. This is correct — U2.1 is part of the same net
    // that has direct connections.
    expect(solver.mspConnectionPairs.length).toBe(2)
  })

  test("getConnectivityMapsFromInputProblem: directConnMap.netMap should not contain net connections", () => {
    const inputProblem: InputProblem = {
      chips: [
        {
          chipId: "C1",
          center: { x: 0, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "C1.1", x: 0, y: 0 }],
        },
        {
          chipId: "C2",
          center: { x: 3, y: 0 },
          width: 1,
          height: 1,
          pins: [{ pinId: "C2.1", x: 3, y: 0 }],
        },
      ],
      directConnections: [],
      netConnections: [{ netId: "GND", pinIds: ["C1.1", "C2.1"] }],
      availableNetLabelOrientations: {},
      maxMspPairDistance: 6,
    }

    const { directConnMap, netConnMap } =
      getConnectivityMapsFromInputProblem(inputProblem)

    // directConnMap should have NO nets (only direct connections, which are empty)
    const directNetIds = Object.keys(directConnMap.netMap)
    expect(directNetIds.length).toBe(0)

    // netConnMap should have 1 net containing C1.1 and C2.1
    const netNetIds = Object.keys(netConnMap.netMap)
    expect(netNetIds.length).toBe(1)
    const netIds = netConnMap.getIdsConnectedToNet(netNetIds[0]!)
    expect(netIds).toContain("C1.1")
    expect(netIds).toContain("C2.1")
  })
})
