import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { useMemo } from "react"
import type { InputProblem } from "lib/types/InputProblem"
import { SameNetTraceSegmentCombiner } from "lib/solvers/SameNetTraceSegmentCombiner/SameNetTraceSegmentCombiner"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { ConnectivityMap } from "connectivity-map"

// Two horizontal traces from the same net that are close together
const traceA: SolvedTracePath = {
  mspPairId: "traceA",
  globalConnNetId: "net1",
  tracePath: [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
  ],
  connectedPinIds: ["pin1", "pin2"],
}

const traceB: SolvedTracePath = {
  mspPairId: "traceB",
  globalConnNetId: "net1",
  tracePath: [
    { x: 0.5, y: 0.05 },
    { x: 1.5, y: 0.05 },
  ],
  connectedPinIds: ["pin3", "pin4"],
}

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
  netConnections: [
    { netId: "net1", pinIds: ["pin1", "pin2", "pin3", "pin4"] },
  ],
  maxMspPairDistance: 5,
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
