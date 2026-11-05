import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { InputProblem } from "lib/types/InputProblem"
import { createTrace } from "../../TraceCleanupSolver/fixtures/alignSameNetRails"

export const createCrossedPortLabelsFixture = () => {
  const pins = [
    { pinId: "U.A", chipId: "U", x: 0, y: 0 },
    { pinId: "U.B", chipId: "U", x: 0, y: -0.4 },
  ]
  const inputProblem: InputProblem = {
    chips: [
      { chipId: "U", center: { x: 0.5, y: 0 }, width: 1, height: 2, pins },
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const netLabelPlacements: NetLabelPlacement[] = [
    {
      globalConnNetId: "A",
      netId: "A",
      pinIds: ["U.A"],
      mspConnectionPairIds: [],
      orientation: "y+",
      anchorPoint: { x: -2, y: 0.1 },
      center: { x: -2, y: 0.3 },
      width: 1,
      height: 0.4,
    },
    {
      globalConnNetId: "B",
      netId: "B",
      pinIds: ["U.B"],
      mspConnectionPairIds: [],
      orientation: "y+",
      anchorPoint: { x: -0.6, y: -0.1 },
      center: { x: -0.6, y: 0.1 },
      width: 1,
      height: 0.4,
    },
  ]
  const traces = netLabelPlacements.map((label, index) => {
    const pin = pins[index]!
    return {
      ...createTrace(
        `connector-${index}`,
        [
          { x: pin.x, y: pin.y },
          { x: label.anchorPoint.x, y: pin.y },
          label.anchorPoint,
        ],
        [pin, pin],
        label.globalConnNetId,
      ),
      pinIds: [pin.pinId],
    }
  })
  traces.push({
    ...createTrace(
      "rail",
      [
        { x: 0, y: 0.3 },
        { x: -3, y: 0.3 },
        { x: -3, y: 3 },
        { x: 0, y: 3 },
      ],
      [pins[0]!, pins[1]!],
      "rail",
    ),
    pinIds: [],
  })
  return {
    inputProblem,
    traces,
    netLabelPlacements,
    netLabelConnectorTraceIds: new Set(["connector-0", "connector-1"]),
    onlyOverlappingLabels: true,
  }
}
