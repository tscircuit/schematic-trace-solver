import type { InputProblem } from "lib/types/InputProblem"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import {
  getPinMap,
  getTracePins,
} from "lib/solvers/AvailableNetOrientationSolver/traces"
import sourceInput from "./repro-rp2040-shaft-position.input.json"

/** Replay the published SDA wire and SCL tag/stub at the label-clearance stage.
 * The upstream pipeline currently chooses different routes (see the repro README).
 * Disable new inline conversions so this regression preserves the reported tags.
 */
export const getShaftPositionLabelClearanceInput = () => {
  const inputProblem = structuredClone(sourceInput) as unknown as InputProblem
  for (const connection of inputProblem.directConnections) {
    connection.allowInlineNetLabel = false
  }
  inputProblem.textBoxes!.push({
    text: "ENC_SDA",
    center: { x: -8.6425, y: 0.5989999999999993 },
    width: 0.64,
    height: 0.12,
  })
  const pinMap = getPinMap(inputProblem)
  const label: NetLabelPlacement = {
    netId: "ENC_SCL",
    netLabelText: "ENC_SCL",
    globalConnNetId: "ENC_SCL",
    pinIds: ["R_ENC_SCL.1"],
    mspConnectionPairIds: [],
    orientation: "y-",
    anchorPoint: { x: -9, y: 0.5399999999999991 },
    center: { x: -9, y: 0.4499999999999992 },
    width: 0.96,
    height: 0.18,
  }
  const connectorId = "inline-net-label-clearance-7-R_ENC_SCL_SIGNAL"
  const sdaPinIds = ["R_ENC_SDA.1", "U_ENCODER.6"]
  const traces: SolvedTracePath[] = [
    {
      mspPairId: "shaft-position-sda",
      mspConnectionPairIds: ["shaft-position-sda"],
      dcConnNetId: "ENC_SDA",
      globalConnNetId: "ENC_SDA",
      userNetId: "ENC_SDA",
      pinIds: sdaPinIds,
      pins: [pinMap[sdaPinIds[0]!]!, pinMap[sdaPinIds[1]!]!],
      tracePath: [
        { x: -11, y: 1.9000000000000001 },
        { x: -11, y: 0.5389999999999993 },
        { x: -6.285, y: 0.5389999999999993 },
      ],
    },
    {
      mspPairId: connectorId,
      mspConnectionPairIds: [connectorId],
      dcConnNetId: "ENC_SCL",
      globalConnNetId: "ENC_SCL",
      userNetId: "ENC_SCL",
      pinIds: label.pinIds,
      pins: getTracePins(label, pinMap),
      tracePath: [{ x: -9, y: 1.9000000000000001 }, { ...label.anchorPoint }],
    },
  ]
  return {
    inputProblem,
    traces,
    netLabelPlacements: [label],
    netLabelConnectorTraceIds: new Set([connectorId]),
  }
}
