import { GenericSolverDebugger } from "site/components/GenericSolverDebugger"
import { TraceLineMergerSolver } from "lib/solvers/TraceLineMergerSolver/TraceLineMergerSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { useMemo } from "react"

export const inputProblem: InputProblem = {
  chips: [
    {
      chipId: "U1",
      center: { x: 0, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U1.1", x: -0.8, y: 0.2 },
        { pinId: "U1.2", x: -0.8, y: 0 },
        { pinId: "U1.3", x: -0.8, y: -0.2 },
        { pinId: "U1.4", x: 0.8, y: -0.2 },
        { pinId: "U1.5", x: 0.8, y: 0 },
        { pinId: "U1.6", x: 0.8, y: 0.2 },
      ],
    },
    {
      chipId: "U2",
      center: { x: 3, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U2.1", x: 2.2, y: 0.2 },
        { pinId: "U2.2", x: 2.2, y: 0 },
        { pinId: "U2.3", x: 2.2, y: -0.2 },
        { pinId: "U2.4", x: 3.8, y: -0.2 },
        { pinId: "U2.5", x: 3.8, y: 0 },
        { pinId: "U2.6", x: 3.8, y: 0.2 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

// Create test trace paths with close lines that should be merged
const createTestTracePaths = (): SolvedTracePath[] => [
  // Horizontal segments on the same Y level - should be merged
  {
    mspPairId: "pair1",
    dcConnNetId: "VCC",
    globalConnNetId: "VCC",
    userNetId: "VCC",
    pins: [
      { pinId: "U1.1", x: -0.8, y: 0.2, chipId: "U1" },
      { pinId: "U2.1", x: 2.2, y: 0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: -0.8, y: 0.2 },
      { x: 0.5, y: 0.2 },
    ],
    mspConnectionPairIds: ["pair1"],
    pinIds: ["U1.1", "U2.1"],
  },
  {
    mspPairId: "pair2",
    dcConnNetId: "VCC",
    globalConnNetId: "VCC",
    userNetId: "VCC",
    pins: [
      { pinId: "U1.1", x: -0.8, y: 0.2, chipId: "U1" },
      { pinId: "U2.1", x: 2.2, y: 0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: 0.52, y: 0.2 }, // Small gap from previous segment
      { x: 2.2, y: 0.2 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["U1.1", "U2.1"],
  },
  // Vertical segments on the same X level - should be merged
  {
    mspPairId: "pair3",
    dcConnNetId: "GND",
    globalConnNetId: "GND",
    userNetId: "GND",
    pins: [
      { pinId: "U1.3", x: -0.8, y: -0.2, chipId: "U1" },
      { pinId: "U2.3", x: 2.2, y: -0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: 1, y: -0.2 },
      { x: 1, y: 0.5 },
    ],
    mspConnectionPairIds: ["pair3"],
    pinIds: ["U1.3", "U2.3"],
  },
  {
    mspPairId: "pair4",
    dcConnNetId: "GND",
    globalConnNetId: "GND",
    userNetId: "GND",
    pins: [
      { pinId: "U1.3", x: -0.8, y: -0.2, chipId: "U1" },
      { pinId: "U2.3", x: 2.2, y: -0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: 1.02, y: 0.5 }, // Small gap from previous segment
      { x: 1, y: 1.5 },
    ],
    mspConnectionPairIds: ["pair4"],
    pinIds: ["U1.3", "U2.3"],
  },
  // Non-mergeable segment (different net)
  {
    mspPairId: "pair5",
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    userNetId: "SIGNAL",
    pins: [
      { pinId: "U1.2", x: -0.8, y: 0, chipId: "U1" },
      { pinId: "U2.2", x: 2.2, y: 0, chipId: "U2" },
    ],
    tracePath: [
      { x: -0.8, y: 0 },
      { x: 2.2, y: 0 },
    ],
    mspConnectionPairIds: ["pair5"],
    pinIds: ["U1.2", "U2.2"],
  },
]

export default () => {
  const solver = useMemo(() => {
    return new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths: createTestTracePaths(),
      maxMergeDistance: 0.1,
    })
  }, [])
  
  return <GenericSolverDebugger solver={solver} />
}
