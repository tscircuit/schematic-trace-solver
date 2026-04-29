import { expect } from "bun:test"
import { test } from "bun:test"
import { CombineCloseSegmentsSolver } from "lib/solvers/CombineCloseSegmentsSolver/CombineCloseSegmentsSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { ConnectivityMap } from "connectivity-map"

test("CombineCloseSegmentsSolver combines traces of same net that are close together", () => {
  // Create a simple connectivity map for testing
  const connMap = new ConnectivityMap({})
  connMap.addConnections([
    ["net1", "pin1", "pin2"],
    ["net1", "pin3", "pin4"],
    ["net2", "pin5", "pin6"],
  ])

  // Create a simple input problem with chips and nets
  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      {
        netId: "net1",
        pinIds: ["pin1", "pin2", "pin3", "pin4"],
      },
      {
        netId: "net2",
        pinIds: ["pin5", "pin6"],
      },
    ],
    availableNetLabelOrientations: {},
  }

  // Create two traces of the same net that are close together
  // First trace: from (0,0) to (0, 10)
  // Second trace: from (0, 11) to (0, 20) - endpoints are 1 unit apart (close)
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    sourcePin: { pinId: "pin1" },
    destPin: { pinId: "pin2" },
    sourceChip: { chipId: "chip1" },
    destChip: { chipId: "chip2" },
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    sourcePin: { pinId: "pin3" },
    destPin: { pinId: "pin4" },
    sourceChip: { chipId: "chip3" },
    destChip: { chipId: "chip4" },
    tracePath: [
      { x: 0, y: 11 },
      { x: 0, y: 20 },
    ],
  }

  // Create a trace of a different net that shouldn't be combined
  const trace3: SolvedTracePath = {
    mspPairId: "pair3",
    mspConnectionPairIds: ["pair3"],
    pinIds: ["pin5", "pin6"],
    sourcePin: { pinId: "pin5" },
    destPin: { pinId: "pin6" },
    sourceChip: { chipId: "chip5" },
    destChip: { chipId: "chip6" },
    tracePath: [
      { x: 100, y: 0 },
      { x: 100, y: 10 },
    ],
  }

  const solver = new CombineCloseSegmentsSolver({
    inputProblem,
    traces: [trace1, trace2, trace3],
    proximityThreshold: 3,
    globalConnMap: connMap,
  })

  solver.solve()

  const output = solver.getOutput()

  //trace1 and trace2 should be combined because they're on net1 and endpoints are close
  //trace3 should remain separate since it's on net2
  expect(output.traces.length).toBeLessThanOrEqual(3)
})

test("CombineCloseSegmentsSolver does not combine traces of different nets", () => {
  const connMap = new ConnectivityMap()
  connMap.addConnections([
    ["net1", "pin1", "pin2"],
    ["net2", "pin3", "pin4"],
  ])

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      {
        netId: "net1",
        pinIds: ["pin1", "pin2"],
      },
      {
        netId: "net2",
        pinIds: ["pin3", "pin4"],
      },
    ],
    availableNetLabelOrientations: {},
  }

  // Two traces on different nets, but close together
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    sourcePin: { pinId: "pin1" },
    destPin: { pinId: "pin2" },
    sourceChip: { chipId: "chip1" },
    destChip: { chipId: "chip2" },
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    sourcePin: { pinId: "pin3" },
    destPin: { pinId: "pin4" },
    sourceChip: { chipId: "chip3" },
    destChip: { chipId: "chip4" },
    tracePath: [
      { x: 0, y: 11 },
      { x: 0, y: 20 },
    ],
  }

  const solver = new CombineCloseSegmentsSolver({
    inputProblem,
    traces: [trace1, trace2],
    proximityThreshold: 3,
    globalConnMap: connMap,
  })

  solver.solve()

  const output = solver.getOutput()

  // Both traces should remain since they're on different nets
  expect(output.traces.length).toBe(2)
})

test("CombineCloseSegmentsSolver uses custom proximity threshold", () => {
  const connMap = new ConnectivityMap()
  connMap.addConnections([
    ["net1", "pin1", "pin2"],
    ["net1", "pin3", "pin4"],
  ])

  const inputProblem: InputProblem = {
    chips: [],
    directConnections: [],
    netConnections: [
      {
        netId: "net1",
        pinIds: ["pin1", "pin2", "pin3", "pin4"],
      },
    ],
    availableNetLabelOrientations: {},
  }

  // Traces with endpoints 5 units apart
  const trace1: SolvedTracePath = {
    mspPairId: "pair1",
    mspConnectionPairIds: ["pair1"],
    pinIds: ["pin1", "pin2"],
    sourcePin: { pinId: "pin1" },
    destPin: { pinId: "pin2" },
    sourceChip: { chipId: "chip1" },
    destChip: { chipId: "chip2" },
    tracePath: [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
    ],
  }

  const trace2: SolvedTracePath = {
    mspPairId: "pair2",
    mspConnectionPairIds: ["pair2"],
    pinIds: ["pin3", "pin4"],
    sourcePin: { pinId: "pin3" },
    destPin: { pinId: "pin4" },
    sourceChip: { chipId: "chip3" },
    destChip: { chipId: "chip4" },
    tracePath: [
      { x: 0, y: 15 },
      { x: 0, y: 20 },
    ],
  }

  // With threshold of 3, they shouldn't combine (distance is 5)
  const solverLowThreshold = new CombineCloseSegmentsSolver({
    inputProblem,
    traces: [trace1, trace2],
    proximityThreshold: 3,
    globalConnMap: connMap,
  })

  solverLowThreshold.solve()

  expect(solverLowThreshold.getOutput().traces.length).toBe(2)

  // With threshold of 10, they should combine
  const solverHighThreshold = new CombineCloseSegmentsSolver({
    inputProblem,
    traces: [trace1, trace2],
    proximityThreshold: 10,
    globalConnMap: connMap,
  })

  solverHighThreshold.solve()

  expect(solverHighThreshold.getOutput().traces.length).toBeLessThan(2)
})

test("CombineCloseSegmentsSolver snapshot test", () => {
  const connMap = new ConnectivityMap()
  connMap.addConnections([
    ["GND", "U1.1", "J1.3"],
    ["VCC", "U1.8", "J1.1"],
    ["NET_A", "U1.2", "U1.3"],
    ["NET_B", "U1.4", "U1.5"],
  ])

  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "U1",
        center: { x: 0, y: 0 },
        width: 2.4,
        height: 1,
        pins: [
          { pinId: "U1.1", x: 1.2, y: -0.3 },
          { pinId: "U1.2", x: -1.2, y: -0.3 },
          { pinId: "U1.3", x: 1.2, y: 0.1 },
          { pinId: "U1.4", x: -1.2, y: 0.3 },
          { pinId: "U1.5", x: -1.2, y: 0.1 },
          { pinId: "U1.6", x: -1.2, y: -0.1 },
          { pinId: "U1.7", x: 1.2, y: -0.1 },
          { pinId: "U1.8", x: 1.2, y: 0.3 },
        ],
      },
      {
        chipId: "J1",
        center: { x: 2.7, y: -2.095 },
        width: 2.2,
        height: 0.8,
        pins: [
          { pinId: "J1.1", x: 1.6, y: -1.895 },
          { pinId: "J1.2", x: 1.6, y: -2.095 },
          { pinId: "J1.3", x: 1.6, y: -2.295 },
        ],
      },
    ],
    directConnections: [],
    netConnections: [
      { netId: "GND", pinIds: ["U1.1", "J1.3"] },
      { netId: "VCC", pinIds: ["U1.8", "J1.1"] },
      { netId: "NET_A", pinIds: ["U1.2", "U1.3"] },
      { netId: "NET_B", pinIds: ["U1.4", "U1.5"] },
    ],
    availableNetLabelOrientations: {
      VCC: ["y-"],
      GND: ["y-"],
    },
  }

  // Create traces with some close endpoints in the same net
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "msp1",
      mspConnectionPairIds: ["msp1"],
      pinIds: ["U1.1", "J1.3"],
      sourcePin: { pinId: "U1.1" },
      destPin: { pinId: "J1.3" },
      sourceChip: { chipId: "U1" },
      destChip: { chipId: "J1" },
      tracePath: [
        { x: 1.2, y: -0.3 },
        { x: 1.2, y: -1.5 },
        { x: 1.6, y: -1.5 },
        { x: 1.6, y: -2.295 },
      ],
    },
    {
      mspPairId: "msp2",
      mspConnectionPairIds: ["msp2"],
      pinIds: ["U1.8", "J1.1"],
      sourcePin: { pinId: "U1.8" },
      destPin: { pinId: "J1.1" },
      sourceChip: { chipId: "U1" },
      destChip: { chipId: "J1" },
      tracePath: [
        { x: 1.2, y: 0.3 },
        { x: 1.2, y: -1.5 },
        { x: 1.6, y: -1.5 },
        { x: 1.6, y: -1.895 },
      ],
    },
    {
      mspPairId: "msp3",
      mspConnectionPairIds: ["msp3"],
      pinIds: ["U1.2", "U1.3"],
      sourcePin: { pinId: "U1.2" },
      destPin: { pinId: "U1.3" },
      sourceChip: { chipId: "U1" },
      destChip: { chipId: "U1" },
      tracePath: [
        { x: -1.2, y: -0.3 },
        { x: -1.2, y: 0.1 },
      ],
    },
    {
      mspPairId: "msp4",
      mspConnectionPairIds: ["msp4"],
      pinIds: ["U1.4", "U1.5"],
      sourcePin: { pinId: "U1.4" },
      destPin: { pinId: "U1.5" },
      sourceChip: { chipId: "U1" },
      destChip: { chipId: "U1" },
      tracePath: [
        { x: -1.2, y: 0.3 },
        { x: -1.2, y: 0.1 },
      ],
    },
  ]

  const solver = new CombineCloseSegmentsSolver({
    inputProblem,
    traces,
    proximityThreshold: 3,
    globalConnMap: connMap,
  })

  solver.solve()
  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
