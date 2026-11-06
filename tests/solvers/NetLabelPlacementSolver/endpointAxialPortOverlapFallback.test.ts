import { expect, test } from "bun:test"
import { getConnectivityMapsFromInputProblem } from "lib/solvers/MspConnectionPairSolver/getConnectivityMapFromInputProblem"
import type { MspConnectionPairId } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { NetLabelPlacementSolver } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { getRectBounds } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/geometry"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("falls back to an outward axial endpoint orientation when a short segment label overlaps an adjacent port-only label", () => {
  const inputProblem: InputProblem = {
    chips: [
      {
        chipId: "BZ1",
        center: { x: 12.27, y: -1.54 },
        width: 0.8,
        height: 0.8,
        pins: [
          {
            pinId: "BZ1_POS",
            x: 11.87,
            y: -1.34,
            _facingDirection: "x-",
          },
          {
            pinId: "BZ1_NEG",
            x: 11.87,
            y: -1.74,
            _facingDirection: "x-",
          },
        ],
      },
      {
        chipId: "Q1",
        center: { x: 11.69, y: -2.74 },
        width: 0.68,
        height: 0.4,
        pins: [
          {
            pinId: "Q1_D",
            x: 11.75,
            y: -1.74,
            _facingDirection: "y+",
          },
        ],
      },
      {
        chipId: "D1",
        center: { x: 8.94, y: -0.52 },
        width: 1.46,
        height: 1.04,
        pins: [
          {
            pinId: "D1_K",
            x: 9.4,
            y: 0,
            _facingDirection: "y+",
          },
          {
            pinId: "D1_A",
            x: 9.4,
            y: -1.04,
            _facingDirection: "y-",
          },
        ],
      },
    ],
    directConnections: [
      {
        pinIds: ["Q1_D", "BZ1_NEG"],
        netId: "BUZZER_SINK",
        netLabelText: "BUZZER_SINK",
        netLabelWidth: 1.44,
      },
      {
        pinIds: ["D1_A", "Q1_D"],
        netId: "BUZZER_SINK",
        netLabelText: "BUZZER_SINK",
        netLabelWidth: 1.44,
      },
    ],
    netConnections: [
      {
        netId: "V3V3",
        pinIds: ["BZ1_POS", "D1_K"],
        netLabelText: "V3V3",
        netLabelWidth: 0.42,
        netLabelHeight: 0.6,
      },
    ],
    availableNetLabelOrientations: {
      V3V3: ["y+"],
    },
  }

  const { netConnMap } = getConnectivityMapsFromInputProblem(inputProblem)
  const sinkGlobalNetId = netConnMap.getNetConnectedToId("Q1_D")!
  const pairId = "Q1_D-BZ1_NEG" as MspConnectionPairId
  const inputTraceMap: Record<MspConnectionPairId, SolvedTracePath> = {
    [pairId]: {
      mspPairId: pairId,
      dcConnNetId: sinkGlobalNetId,
      globalConnNetId: sinkGlobalNetId,
      userNetId: "BUZZER_SINK",
      pins: [
        {
          pinId: "Q1_D",
          x: 11.75,
          y: -1.74,
          _facingDirection: "y+",
          chipId: "Q1",
        },
        {
          pinId: "BZ1_NEG",
          x: 11.87,
          y: -1.74,
          _facingDirection: "x-",
          chipId: "BZ1",
        },
      ],
      tracePath: [
        { x: 11.75, y: -1.74 },
        { x: 11.87, y: -1.74 },
      ],
      mspConnectionPairIds: [pairId],
      pinIds: ["Q1_D", "BZ1_NEG"],
    },
  }

  const solver = new NetLabelPlacementSolver({
    inputProblem,
    inputTraceMap,
  })
  solver.solve()

  const supplyLabel = solver.netLabelPlacements.find((label) =>
    label.pinIds.includes("BZ1_POS"),
  )
  const sinkLabel = solver.netLabelPlacements.find(
    (label) =>
      label.pinIds.includes("Q1_D") && label.pinIds.includes("BZ1_NEG"),
  )

  expect(supplyLabel).toBeDefined()
  expect(sinkLabel).toBeDefined()
  expect(sinkLabel!.orientation).toBe("x-")
  expect(sinkLabel!.anchorPoint).toEqual({ x: 11.75, y: -1.74 })

  const supplyBounds = getRectBounds(
    supplyLabel!.center,
    supplyLabel!.width,
    supplyLabel!.height,
  )
  const sinkBounds = getRectBounds(
    sinkLabel!.center,
    sinkLabel!.width,
    sinkLabel!.height,
  )
  const overlaps =
    supplyBounds.minX < sinkBounds.maxX - 1e-9 &&
    supplyBounds.maxX > sinkBounds.minX + 1e-9 &&
    supplyBounds.minY < sinkBounds.maxY - 1e-9 &&
    supplyBounds.maxY > sinkBounds.minY + 1e-9
  expect(overlaps).toBe(false)
})
