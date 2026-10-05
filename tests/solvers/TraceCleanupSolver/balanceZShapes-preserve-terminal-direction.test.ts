import { expect, test } from "bun:test"
import { balanceZShapes } from "lib/solvers/TraceCleanupSolver/balanceZShapes"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

test("balancing preserves outward terminal approaches in all four directions", () => {
  // Schematic world coordinates in mm: +X right, +Y up. Rotate both U and Z
  // paths to exercise horizontal and vertical terminal approaches.
  for (const rotation of [0, 1, 2, 3]) {
    const rotate = ({ x, y }: { x: number; y: number }) =>
      [
        { x, y },
        { x: -y, y: x },
        { x: -x, y: -y },
        { x: y, y: -x },
      ][rotation]!
    for (const isUShape of [true, false]) {
      const tracePath = [
        { x: -0.3, y: 0 },
        { x: isUShape ? -1.3 : -1.8, y: 0 },
        { x: isUShape ? -1.3 : -1.8, y: -1.74 },
        { x: isUShape ? -1.1 : -2.3, y: -1.74 },
      ].map(rotate)
      const trace: SolvedTracePath = {
        mspPairId: "signal",
        globalConnNetId: "signal",
        dcConnNetId: "signal",
        pins: [
          { ...tracePath[0]!, pinId: "source", chipId: "source" },
          { ...tracePath[3]!, pinId: "destination", chipId: "destination" },
        ],
        pinIds: ["source", "destination"],
        mspConnectionPairIds: ["signal"],
        tracePath,
      }
      const inputProblem: InputProblem = {
        chips: [],
        directConnections: [],
        netConnections: [],
        availableNetLabelOrientations: {},
      }
      const output = balanceZShapes({
        targetMspConnectionPairId: "signal",
        traces: [trace],
        inputProblem,
        allLabelPlacements: [],
        mergedLabelNetIdMap: {},
        paddingBuffer: 0.2,
      })
      if (isUShape) {
        expect(output.tracePath).toEqual(tracePath)
      } else {
        // Genuine Z paths still balance, without reversing either terminal.
        const expectedPath = [
          rotate({ x: -0.3, y: 0 }),
          rotate({ x: -1.3, y: 0 }),
          rotate({ x: -1.3, y: -1.74 }),
          rotate({ x: -2.3, y: -1.74 }),
        ]
        expect(output.tracePath).toHaveLength(4)
        for (let i = 0; i < 4; i++) {
          expect(output.tracePath[i]!.x).toBeCloseTo(expectedPath[i]!.x, 9)
          expect(output.tracePath[i]!.y).toBeCloseTo(expectedPath[i]!.y, 9)
        }
      }
    }
  }
})
