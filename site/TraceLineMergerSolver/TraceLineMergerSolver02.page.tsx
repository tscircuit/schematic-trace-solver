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
      center: { x: 4, y: 0 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U2.1", x: 3.2, y: 0.2 },
        { pinId: "U2.2", x: 3.2, y: 0 },
        { pinId: "U2.3", x: 3.2, y: -0.2 },
        { pinId: "U2.4", x: 4.8, y: -0.2 },
        { pinId: "U2.5", x: 4.8, y: 0 },
        { pinId: "U2.6", x: 4.8, y: 0.2 },
      ],
    },
    {
      chipId: "U3",
      center: { x: 2, y: 2 },
      width: 1.6,
      height: 0.6,
      pins: [
        { pinId: "U3.1", x: 1.2, y: 2.2 },
        { pinId: "U3.2", x: 1.2, y: 2 },
        { pinId: "U3.3", x: 1.2, y: 1.8 },
        { pinId: "U3.4", x: 2.8, y: 1.8 },
        { pinId: "U3.5", x: 2.8, y: 2 },
        { pinId: "U3.6", x: 2.8, y: 2.2 },
      ],
    },
  ],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
}

// Create test trace paths with overlapping segments
const createTestTracePaths = (): SolvedTracePath[] => [
  // Overlapping horizontal segments - should be merged
  {
    mspPairId: "pair1",
    dcConnNetId: "VCC",
    globalConnNetId: "VCC",
    userNetId: "VCC",
    pins: [
      { pinId: "U1.1", x: -0.8, y: 0.2, chipId: "U1" },
      { pinId: "U2.1", x: 3.2, y: 0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: -0.8, y: 0.2 },
      { x: 1.5, y: 0.2 },
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
      { pinId: "U2.1", x: 3.2, y: 0.2, chipId: "U2" },
    ],
    tracePath: [
      { x: 1.2, y: 0.2 }, // Overlaps with previous segment
      { x: 3.2, y: 0.2 },
    ],
    mspConnectionPairIds: ["pair2"],
    pinIds: ["U1.1", "U2.1"],
  },
  // Multiple vertical segments that should be merged
  {
    mspPairId: "pair3",
    dcConnNetId: "GND",
    globalConnNetId: "GND",
    userNetId: "GND",
    pins: [
      { pinId: "U1.3", x: -0.8, y: -0.2, chipId: "U1" },
      { pinId: "U3.3", x: 1.2, y: 1.8, chipId: "U3" },
    ],
    tracePath: [
      { x: 0.5, y: -0.2 },
      { x: 0.5, y: 0.8 },
    ],
    mspConnectionPairIds: ["pair3"],
    pinIds: ["U1.3", "U3.3"],
  },
  {
    mspPairId: "pair4",
    dcConnNetId: "GND",
    globalConnNetId: "GND",
    userNetId: "GND",
    pins: [
      { pinId: "U1.3", x: -0.8, y: -0.2, chipId: "U1" },
      { pinId: "U3.3", x: 1.2, y: 1.8, chipId: "U3" },
    ],
    tracePath: [
      { x: 0.52, y: 0.8 }, // Small gap
      { x: 0.5, y: 1.8 },
    ],
    mspConnectionPairIds: ["pair4"],
    pinIds: ["U1.3", "U3.3"],
  },
  // Segments too far apart - should not be merged
  {
    mspPairId: "pair5",
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    userNetId: "SIGNAL",
    pins: [
      { pinId: "U1.2", x: -0.8, y: 0, chipId: "U1" },
      { pinId: "U2.2", x: 3.2, y: 0, chipId: "U2" },
    ],
    tracePath: [
      { x: -0.8, y: 0 },
      { x: 0.5, y: 0 },
    ],
    mspConnectionPairIds: ["pair5"],
    pinIds: ["U1.2", "U2.2"],
  },
  {
    mspPairId: "pair6",
    dcConnNetId: "SIGNAL",
    globalConnNetId: "SIGNAL",
    userNetId: "SIGNAL",
    pins: [
      { pinId: "U1.2", x: -0.8, y: 0, chipId: "U1" },
      { pinId: "U2.2", x: 3.2, y: 0, chipId: "U2" },
    ],
    tracePath: [
      { x: 2.5, y: 0 }, // Too far from previous segment
      { x: 3.2, y: 0 },
    ],
    mspConnectionPairIds: ["pair6"],
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
