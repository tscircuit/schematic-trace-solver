import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import { NetLabelToSameNetTraceSolver } from "lib/solvers/NetLabelToSameNetTraceSolver/NetLabelToSameNetTraceSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getTraceRecoveryConnectivityMaps } from "lib/solvers/NetLabelTraceRecovery/getTraceRecoveryConnectivityMaps"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { FacingDirection } from "lib/utils/dir"

const createProtectedPortRecoveryFixture = ({
  labelNetId,
  directNetId,
  isPowerNet = false,
  labelOrientation,
}: {
  labelNetId: string
  directNetId: string
  isPowerNet?: boolean
  labelOrientation: FacingDirection
}) => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "source_chip",
        center: { x: 0, y: 0 },
        width: 0,
        height: 0,
        pins: [
          {
            pinId: "source_pin",
            x: 0,
            y: 0,
            _facingDirection: "x+",
          },
        ],
      },
      {
        chipId: "direct_peer_chip",
        center: { x: -3, y: 0 },
        width: 0,
        height: 0,
        pins: [
          {
            pinId: "direct_peer_pin",
            x: -3,
            y: 0,
            _facingDirection: "x-",
          },
        ],
      },
      {
        chipId: "target_bottom_chip",
        center: { x: 2, y: -1 },
        width: 0,
        height: 0,
        pins: [
          {
            pinId: "target_bottom_pin",
            x: 2,
            y: -1,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "target_top_chip",
        center: { x: 2, y: 1 },
        width: 0,
        height: 0,
        pins: [
          {
            pinId: "target_top_pin",
            x: 2,
            y: 1,
            _facingDirection: "y-",
          },
        ],
      },
    ],
    directConnections: [
      {
        pinIds: ["source_pin", "direct_peer_pin"],
        netId: directNetId,
        isPowerNet,
      },
    ],
    netConnections: [
      {
        netId: labelNetId,
        pinIds: [
          "source_pin",
          "direct_peer_pin",
          "target_bottom_pin",
          "target_top_pin",
        ],
      },
    ],
    availableNetLabelOrientations: {
      [directNetId]: [labelOrientation],
      [labelNetId]: [labelOrientation],
    },
  }
  const globalConnNetId =
    getConnectivityMapsFromInputProblem(
      inputProblem,
    ).netConnMap.getNetConnectedToId(labelNetId)!
  const { pinMap } = getTraceRecoveryConnectivityMaps(inputProblem)
  const sourcePin = pinMap.get("source_pin")!
  const targetBottomPin = pinMap.get("target_bottom_pin")!
  const targetTopPin = pinMap.get("target_top_pin")!
  const anchorPoint =
    labelOrientation === "y+"
      ? { x: 0, y: 0.5 }
      : labelOrientation === "x-"
        ? { x: -0.5, y: 0 }
        : { x: 0.25, y: 0 }
  const labelSize =
    labelOrientation === "y+"
      ? { width: 0.2, height: 0.45 }
      : { width: 1, height: 0.2 }
  const labelCenter =
    labelOrientation === "y+"
      ? { x: anchorPoint.x, y: anchorPoint.y + labelSize.height / 2 }
      : labelOrientation === "x-"
        ? { x: anchorPoint.x - labelSize.width / 2, y: anchorPoint.y }
        : { x: anchorPoint.x + labelSize.width / 2, y: anchorPoint.y }
  const connectorMspPairId = `available-net-orientation-0-${labelNetId}`
  const connectorTrace: SolvedTracePath = {
    mspPairId: connectorMspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: labelNetId,
    pins: [sourcePin, sourcePin],
    tracePath: [sourcePin, anchorPoint],
    mspConnectionPairIds: [connectorMspPairId],
    pinIds: [sourcePin.pinId],
  }
  const targetTrace: SolvedTracePath = {
    mspPairId: "target_bottom_pin-target_top_pin",
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    userNetId: labelNetId,
    pins: [targetBottomPin, targetTopPin],
    tracePath: [targetBottomPin, targetTopPin],
    mspConnectionPairIds: ["target_bottom_pin-target_top_pin"],
    pinIds: [targetBottomPin.pinId, targetTopPin.pinId],
  }
  const label: NetLabelPlacement = {
    globalConnNetId,
    dcConnNetId: globalConnNetId,
    netId: labelNetId,
    mspConnectionPairIds: [],
    pinIds: [sourcePin.pinId],
    orientation: labelOrientation,
    anchorPoint,
    center: labelCenter,
    ...labelSize,
  }

  return {
    connectorMspPairId,
    inputProblem,
    label,
    traces: [connectorTrace, targetTrace],
    solver: new NetLabelToSameNetTraceSolver({
      inputProblem,
      traces: [connectorTrace, targetTrace],
      netLabelPlacements: [label],
      inlineNetLabelPlacements: [],
    }),
  }
}

test("retains the connector for a protected port-only y+ label", () => {
  const { connectorMspPairId, label, solver } =
    createProtectedPortRecoveryFixture({
      labelNetId: "VCC",
      directNetId: "VCC",
      labelOrientation: "y+",
    })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.stats.recoveredTraceCount).toBe(1)
  expect(output.netLabelPlacements).toContain(label)
  expect(
    output.traces.some((trace) => trace.mspPairId === connectorMspPairId),
  ).toBe(true)
})

test("retains the protected label with the highest y value", () => {
  const fixture = createProtectedPortRecoveryFixture({
    labelNetId: "VCC",
    directNetId: "VCC",
    labelOrientation: "y+",
  })
  const higherLabel: NetLabelPlacement = {
    ...fixture.label,
    pinIds: ["target_bottom_pin"],
    anchorPoint: {
      ...fixture.label.anchorPoint,
      y: fixture.label.anchorPoint.y + 5,
    },
    center: {
      ...fixture.label.center,
      y: fixture.label.center.y + 5,
    },
  }
  const solver = new NetLabelToSameNetTraceSolver({
    inputProblem: fixture.inputProblem,
    traces: fixture.traces,
    netLabelPlacements: [fixture.label, higherLabel],
    inlineNetLabelPlacements: [],
  })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.stats.recoveredTraceCount).toBe(1)
  expect(output.netLabelPlacements).toContain(higherLabel)
  expect(output.netLabelPlacements).not.toContain(fixture.label)
})

test("retains a power label whose net id aliases the marked power net", () => {
  const { connectorMspPairId, label, solver } =
    createProtectedPortRecoveryFixture({
      labelNetId: "3V3",
      directNetId: "VCC",
      isPowerNet: true,
      labelOrientation: "x-",
    })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.stats.recoveredTraceCount).toBe(1)
  expect(output.netLabelPlacements).toContain(label)
  expect(
    output.traces.some((trace) => trace.mspPairId === connectorMspPairId),
  ).toBe(true)
})

test("rejects a recovered route through its retained label", () => {
  const { connectorMspPairId, label, solver } =
    createProtectedPortRecoveryFixture({
      labelNetId: "VCC",
      directNetId: "VCC",
      isPowerNet: true,
      labelOrientation: "x+",
    })

  solver.solve()
  const output = solver.getOutput()

  expect(solver.stats.recoveredTraceCount).toBe(0)
  expect(output.netLabelPlacements).toContain(label)
  expect(
    output.traces.some((trace) => trace.mspPairId === connectorMspPairId),
  ).toBe(true)
})
