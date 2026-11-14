import { TraceLineMergerSolver } from "lib/solvers/TraceLineMergerSolver/TraceLineMergerSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

describe("TraceLineMergerSolver", () => {
  const createTestInputProblem = (): InputProblem => ({
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
    ],
    directConnections: [],
    netConnections: [],
    availableNetLabelOrientations: {},
  })

  const createTestTracePath = (
    tracePath: Array<{ x: number; y: number }>,
    netId: string = "test_net"
  ): SolvedTracePath => ({
    mspPairId: `pair_${Math.random()}`,
    dcConnNetId: netId,
    globalConnNetId: netId,
    userNetId: netId,
    pins: [
      { pinId: "pin1", x: tracePath[0].x, y: tracePath[0].y, chipId: "U1" },
      { pinId: "pin2", x: tracePath[tracePath.length - 1].x, y: tracePath[tracePath.length - 1].y, chipId: "U1" },
    ],
    tracePath,
    mspConnectionPairIds: [`pair_${Math.random()}`],
    pinIds: ["pin1", "pin2"],
  })

  it("should merge horizontally aligned segments", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      // Two horizontal segments on the same Y level
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ], "net1"),
      createTestTracePath([
        { x: 2.05, y: 0 }, // Small gap
        { x: 4, y: 0 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(1)
    
    const mergedPath = solver.mergedTracePaths[0]
    expect(mergedPath.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ])
    expect(mergedPath.originalTracePaths).toHaveLength(2)
  })

  it("should merge vertically aligned segments", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      // Two vertical segments on the same X level
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 0, y: 2 },
      ], "net1"),
      createTestTracePath([
        { x: 0.05, y: 2 }, // Small gap
        { x: 0, y: 4 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(1)
    
    const mergedPath = solver.mergedTracePaths[0]
    expect(mergedPath.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 4 },
    ])
    expect(mergedPath.originalTracePaths).toHaveLength(2)
  })

  it("should not merge segments from different nets", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ], "net1"),
      createTestTracePath([
        { x: 2.05, y: 0 },
        { x: 4, y: 0 },
      ], "net2"), // Different net
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(2) // Should remain separate
  })

  it("should not merge segments that are too far apart", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ], "net1"),
      createTestTracePath([
        { x: 3, y: 0 }, // Too far apart
        { x: 5, y: 0 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(2) // Should remain separate
  })

  it("should handle overlapping segments", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ], "net1"),
      createTestTracePath([
        { x: 2, y: 0 }, // Overlaps with first segment
        { x: 4, y: 0 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(1)
    
    const mergedPath = solver.mergedTracePaths[0]
    expect(mergedPath.tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ])
  })

  it("should handle complex multi-segment paths", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
      ], "net1"),
      createTestTracePath([
        { x: 2.05, y: 2 }, // Small gap
        { x: 4, y: 2 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
      maxMergeDistance: 0.1,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(1)
    
    const mergedPath = solver.mergedTracePaths[0]
    // Should merge the horizontal segments at y=2
    // The exact path structure may vary, but it should contain the merged segment
    expect(mergedPath.tracePath.length).toBeGreaterThanOrEqual(3)
    
    // Check that the merged segment (2,2) to (4,2) is present
    const distance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => 
      Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
    
    const hasMergedSegment = mergedPath.tracePath.some((point, index) => {
      if (index < mergedPath.tracePath.length - 1) {
        const nextPoint = mergedPath.tracePath[index + 1]
        return distance(point, { x: 2, y: 2 }) < 0.1 && 
               distance(nextPoint, { x: 4, y: 2 }) < 0.1
      }
      return false
    })
    expect(hasMergedSegment).toBe(true)
  })

  it("should handle empty input", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = []

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(0)
  })

  it("should handle single trace path", () => {
    const inputProblem = createTestInputProblem()
    const inputTracePaths: SolvedTracePath[] = [
      createTestTracePath([
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ], "net1"),
    ]

    const solver = new TraceLineMergerSolver({
      inputProblem,
      inputTracePaths,
    })

    solver.solve()

    expect(solver.solved).toBe(true)
    expect(solver.mergedTracePaths).toHaveLength(1)
    expect(solver.mergedTracePaths[0].tracePath).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })
})
