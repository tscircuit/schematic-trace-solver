import { useMemo } from "react"
import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { SameNetTraceMergeSolver } from "lib/solvers/SameNetTraceMergeSolver/SameNetTraceMergeSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "L",
      center: { x: -2, y: 1 },
      width: 0.4,
      height: 1.2,
      pins: [
        { pinId: "L.1", x: -1.8, y: 1.5 },
        { pinId: "L.2", x: -1.8, y: 0.5 },
      ],
    },
    {
      chipId: "R",
      center: { x: 2, y: 1 },
      width: 0.4,
      height: 1.2,
      pins: [
        { pinId: "R.1", x: 1.8, y: 1.5 },
        { pinId: "R.2", x: 1.8, y: 0.5 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [
    { netId: "NET1", pinIds: ["L.1", "R.1", "L.2", "R.2"] },
  ],
  availableNetLabelOrientations: {},
}

const traces: SolvedTracePath[] = [
  {
    mspPairId: "A",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    pins: [
      { pinId: "L.1", x: -1.8, y: 1.5, chipId: "L" },
      { pinId: "R.1", x: 1.8, y: 1.5, chipId: "R" },
    ],
    tracePath: [
      { x: -1.8, y: 1.5 },
      { x: 0, y: 1.5 },
      { x: 0, y: 1.5 },
      { x: 1.8, y: 1.5 },
    ],
    mspConnectionPairIds: ["A"],
    pinIds: ["L.1", "R.1"],
  },
  {
    mspPairId: "B",
    dcConnNetId: "NET1",
    globalConnNetId: "NET1",
    pins: [
      { pinId: "L.2", x: -1.8, y: 0.5, chipId: "L" },
      { pinId: "R.2", x: 1.8, y: 0.5, chipId: "R" },
    ],
    tracePath: [
      { x: -1.8, y: 0.5 },
      { x: -1, y: 0.5 },
      { x: -1, y: 1.55 },
      { x: 1, y: 1.55 },
      { x: 1, y: 0.5 },
      { x: 1.8, y: 0.5 },
    ],
    mspConnectionPairIds: ["B"],
    pinIds: ["L.2", "R.2"],
  },
]

export default () => {
  const solver = useMemo(
    () =>
      new SameNetTraceMergeSolver({
        inputProblem,
        traces,
        gapThreshold: 0.15,
      }),
    [],
  )
  return <GenericSolverDebugger solver={solver} />
}
