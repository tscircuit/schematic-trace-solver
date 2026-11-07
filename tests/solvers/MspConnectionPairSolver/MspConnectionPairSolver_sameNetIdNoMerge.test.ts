import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { test, expect } from "bun:test"
import type { InputProblem } from "lib/types/InputProblem"

/**
 * Test for bug fix: tscircuit/core#1498
 *
 * ISSUE: Schematic traces with the same net name were incorrectly
 * jumping/connecting to each other when they shouldn't.
 *
 * ROOT CAUSE: The getConnectivityMapsFromInputProblem function was
 * merging all directConnections and netConnections with the same netId
 * into a single connectivity group.
 *
 * FIX: Each directConnection and netConnection is now treated as its own
 * connectivity island. Pins are only considered connected if they are
 * explicitly listed in the SAME connection entry.
 */

test("directConnections with same netId should NOT be merged together", () => {
  // Two separate directConnections both have netId "GND"
  // They should NOT be connected to each other
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 3, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.1", x: 2.5, y: 0 },
          { pinId: "U2.2", x: 3.5, y: 0 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 0, y: 2 },
        width: 0.5,
        height: 0.5,
        pins: [{ pinId: "C1.1", x: 0, y: 2 }],
      },
      {
        chipId: "C2",
        center: { x: 3, y: 2 },
        width: 0.5,
        height: 0.5,
        pins: [{ pinId: "C2.1", x: 3, y: 2 }],
      },
    ],
    // Both directConnections have the same netId "GND"
    // but they should NOT be merged together
    directConnections: [
      { pinIds: ["U1.1", "C1.1"], netId: "GND" },
      { pinIds: ["U2.1", "C2.1"], netId: "GND" },
    ],
    netConnections: [],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(inputProblem)

  // U1.1 should be connected to C1.1 (same directConnection)
  expect(directConnMap.areIdsConnected("U1.1", "C1.1")).toBe(true)

  // U2.1 should be connected to C2.1 (same directConnection)
  expect(directConnMap.areIdsConnected("U2.1", "C2.1")).toBe(true)

  // U1.1 should NOT be connected to U2.1 (different directConnections)
  // This was the bug - they were being merged because they shared netId "GND"
  expect(directConnMap.areIdsConnected("U1.1", "U2.1")).toBe(false)

  // U1.1 should NOT be connected to C2.1 (different directConnections)
  expect(directConnMap.areIdsConnected("U1.1", "C2.1")).toBe(false)

  // C1.1 should NOT be connected to C2.1 (different directConnections)
  expect(directConnMap.areIdsConnected("C1.1", "C2.1")).toBe(false)
})

test("netConnections with same netId should NOT be merged together", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
      {
        chipId: "U2",
        center: { x: 5, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.1", x: 4.5, y: 0 },
          { pinId: "U2.2", x: 5.5, y: 0 },
        ],
      },
    ],
    directConnections: [],
    // Two netConnections with the same netId "GND"
    // They should NOT be merged together
    netConnections: [
      { pinIds: ["U1.1", "U1.2"], netId: "GND" },
      { pinIds: ["U2.1", "U2.2"], netId: "GND" },
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)

  // U1.1 should be connected to U1.2 (same netConnection)
  expect(netConnMap.areIdsConnected("U1.1", "U1.2")).toBe(true)

  // U2.1 should be connected to U2.2 (same netConnection)
  expect(netConnMap.areIdsConnected("U2.1", "U2.2")).toBe(true)

  // U1.1 should NOT be connected to U2.1 (different netConnections)
  expect(netConnMap.areIdsConnected("U1.1", "U2.1")).toBe(false)

  // U1.2 should NOT be connected to U2.2 (different netConnections)
  expect(netConnMap.areIdsConnected("U1.2", "U2.2")).toBe(false)
})

test("MspConnectionPairSolver should not create pairs across different directConnections with same netId", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 0, y: 1 },
        width: 0.5,
        height: 0.5,
        pins: [{ pinId: "C1.1", x: 0, y: 1 }],
      },
      {
        chipId: "U2",
        center: { x: 3, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U2.1", x: 2.5, y: 0 },
          { pinId: "U2.2", x: 3.5, y: 0 },
        ],
      },
      {
        chipId: "C2",
        center: { x: 3, y: 1 },
        width: 0.5,
        height: 0.5,
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

  // Should have exactly 2 pairs: U1.1-C1.1 and U2.1-C2.1
  expect(solver.mspConnectionPairs.length).toBe(2)

  // Verify each pair only contains pins from the same directConnection
  for (const pair of solver.mspConnectionPairs) {
    const pinIds = pair.pins.map((p) => p.pinId)

    // Each pair should be either (U1.1, C1.1) or (U2.1, C2.1)
    const isValidPair =
      (pinIds.includes("U1.1") && pinIds.includes("C1.1")) ||
      (pinIds.includes("U2.1") && pinIds.includes("C2.1"))

    expect(isValidPair).toBe(true)

    // Should NOT have cross-connection pairs
    const isCrossConnectionPair =
      (pinIds.includes("U1.1") && pinIds.includes("U2.1")) ||
      (pinIds.includes("U1.1") && pinIds.includes("C2.1")) ||
      (pinIds.includes("C1.1") && pinIds.includes("U2.1")) ||
      (pinIds.includes("C1.1") && pinIds.includes("C2.1"))

    expect(isCrossConnectionPair).toBe(false)
  }
})

test("empty netConnection pinIds arrays should be handled safely", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: 0, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
    ],
    directConnections: [{ pinIds: ["U1.1", "U1.2"], netId: "VCC" }],
    netConnections: [
      { pinIds: [], netId: "NET1" }, // Empty - should be skipped safely
    ],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  // Should not throw
  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(inputProblem)

  // Direct connection should exist
  expect(directConnMap.getNetConnectedToId("U1.1")).toBeDefined()
  expect(directConnMap.areIdsConnected("U1.1", "U1.2")).toBe(true)
})

test("netConnection extending a directConnection should work correctly", () => {
  // A netConnection that includes a pin from an existing directConnection
  // should extend that connection (add more pins to the same island)
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 1,
        height: 1,
        pins: [
          { pinId: "U1.1", x: -0.5, y: 0 },
          { pinId: "U1.2", x: 0.5, y: 0 },
        ],
      },
      {
        chipId: "C1",
        center: { x: 0, y: 1 },
        width: 0.5,
        height: 0.5,
        pins: [{ pinId: "C1.1", x: 0, y: 1 }],
      },
      {
        chipId: "R1",
        center: { x: 0, y: 2 },
        width: 0.5,
        height: 0.5,
        pins: [{ pinId: "R1.1", x: 0, y: 2 }],
      },
    ],
    directConnections: [{ pinIds: ["U1.1", "C1.1"], netId: "NET1" }],
    // This netConnection extends the directConnection by adding R1.1
    netConnections: [{ pinIds: ["C1.1", "R1.1"], netId: "NET1" }],
    availableNetLabelOrientations: {},
    maxMspPairDistance: 10,
  }

  const { directConnMap, netConnMap } =
    getConnectivityMapsFromInputProblem(inputProblem)

  // U1.1 and C1.1 are directly connected
  expect(directConnMap.areIdsConnected("U1.1", "C1.1")).toBe(true)

  // In netConnMap, the netConnection extends the directConnection
  // so U1.1, C1.1, and R1.1 should all be connected
  expect(netConnMap.areIdsConnected("U1.1", "C1.1")).toBe(true)
  expect(netConnMap.areIdsConnected("C1.1", "R1.1")).toBe(true)
  expect(netConnMap.areIdsConnected("U1.1", "R1.1")).toBe(true)
})
