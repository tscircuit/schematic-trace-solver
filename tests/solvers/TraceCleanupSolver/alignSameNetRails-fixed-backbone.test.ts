import { expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { align, createTrace } from "./fixtures/alignSameNetRails"

const createFixture = () => {
  const firstPin = {
    pinId: "C1.1",
    chipId: "C1",
    x: -2,
    y: 0,
    _facingDirection: "y+" as const,
  }
  const sharedPin = {
    pinId: "C2.1",
    chipId: "C2",
    x: 0,
    y: 0,
    _facingDirection: "y+" as const,
  }
  const supplyPin = {
    pinId: "F1.1",
    chipId: "F1",
    x: 1,
    y: 3,
    _facingDirection: "x-" as const,
  }
  const problem: InputProblem = {
    maxMspPairDistance: 2.4,
    chips: [
      {
        chipId: "C1",
        center: { x: -2, y: -0.5 },
        width: 0.8,
        height: 1,
        pins: [firstPin],
      },
      {
        chipId: "C2",
        center: { x: 0, y: -0.5 },
        width: 0.8,
        height: 1,
        pins: [sharedPin],
      },
      {
        chipId: "F1",
        center: { x: 1.5, y: 3 },
        width: 1,
        height: 0.8,
        pins: [supplyPin],
      },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const branch = createTrace(
    "branch",
    [
      { x: -2, y: 0 },
      { x: -2, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
    ],
    [firstPin, sharedPin],
  )
  const backbone = createTrace(
    "backbone",
    [
      { x: 0, y: 0 },
      { x: 0, y: 2 },
      { x: 0.5, y: 2 },
      { x: 0.5, y: 3 },
      { x: 1, y: 3 },
    ],
    [sharedPin, supplyPin],
  )
  const label: NetLabelPlacement = {
    globalConnNetId: "power-net",
    netId: "POWER",
    mspConnectionPairIds: ["backbone"],
    pinIds: backbone.pinIds,
    orientation: "y+",
    anchorPoint: { x: 0, y: 2 },
    center: { x: 0, y: 2.1 },
    width: 0.4,
    height: 0.2,
  }
  return { problem, branch, backbone, label }
}

test("aligns a branch to a labeled backbone without moving its elbows", () => {
  const { problem, branch, backbone, label } = createFixture()
  const result = align([branch, backbone], {
    inputProblem: problem,
    netLabelPlacements: [label],
  })

  expect(result.traces[0]!.tracePath).toEqual([
    { x: -2, y: 0 },
    { x: -2, y: 2 },
    { x: 0, y: 2 },
    { x: 0, y: 0 },
  ])
  expect(result.traces[1]).toEqual(backbone)
})

test("keeps the branch below an obstacle on the fixed backbone coordinate", () => {
  const { problem, branch, backbone, label } = createFixture()
  problem.chips.push({
    chipId: "obstacle",
    center: { x: -1, y: 2 },
    width: 0.4,
    height: 0.4,
    pins: [],
  })
  const result = align([branch, backbone], {
    inputProblem: problem,
    netLabelPlacements: [label],
  })

  expect(result.traces).toEqual([branch, backbone])
})

test("does not pull a multi-turn backbone toward a label on a different coordinate", () => {
  const { problem, branch, backbone, label } = createFixture()
  label.anchorPoint.y = 1.5
  label.center.y = 1.6
  const result = align([branch, backbone], {
    inputProblem: problem,
    netLabelPlacements: [label],
  })

  expect(result.traces).toEqual([branch, backbone])
})
