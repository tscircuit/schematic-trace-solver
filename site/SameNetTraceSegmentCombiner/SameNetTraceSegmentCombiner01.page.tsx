import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { useMemo } from "react"
import type { InputProblem } from "lib/types/InputProblem"
import { SameNetTraceSegmentCombiner } from "lib/solvers/SameNetTraceSegmentCombiner/SameNetTraceSegmentCombiner"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { ConnectivityMap } from "connectivity-map"

const makeTrace = (
  id: string,
  netId: string,
  path: { x: number; y: number }[],
  pIds: string[],
): SolvedTracePath =>
  ({
    mspPairId: id,
    globalConnNetId: netId,
    dcConnNetId: netId,
    tracePath: path,
    mspConnectionPairIds: [id],
    pinIds: pIds,
    pins: [
      { pinId: pIds[0] ?? "p0", x: path[0]!.x, y: path[0]!.y, chipId: "chip1" },
      {
        pinId: pIds[1] ?? "p1",
        x: path[path.length - 1]!.x,
        y: path[path.length - 1]!.y,
        chipId: "chip2",
      },
    ],
  }) as SolvedTracePath

const traceA = makeTrace(
  "traceA",
  "net1",
  [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ],
  ["pin1", "pin2"],
)
const traceB = makeTrace(
  "traceB",
  "net1",
  [
    { x: 0.5, y: 0.05 },
    { x: 1.5, y: 0.05 },
  ],
  ["pin3", "pin4"],
)

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "chip1",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 0.5,
      pins: [
        { pinId: "pin1", x: 0, y: 0 },
        { pinId: "pin2", x: 2, y: 0 },
      ],
    },
    {
      chipId: "chip2",
      center: { x: 1, y: 0.05 },
      width: 0.5,
      height: 0.5,
      pins: [
        { pinId: "pin3", x: 0.5, y: 0.05 },
        { pinId: "pin4", x: 1.5, y: 0.05 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [{ netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] }],
  maxMspPairDistance: 5,
  availableNetLabelOrientations: {},
}

const connMap = new ConnectivityMap({})
connMap.addConnections([["pin1", "pin2", "pin3", "pin4"]])

export default () => {
  const solver = useMemo(
    () =>
      new SameNetTraceSegmentCombiner({
        inputProblem,
        inputTracePaths: [traceA, traceB],
        globalConnMap: connMap,
      }),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
