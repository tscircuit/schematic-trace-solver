import { describe, expect, test } from "bun:test"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { getVisibleTraceLength } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/geometry"
import type { InputPin, InputProblem } from "lib/types/InputProblem"
import { align, createTrace } from "./fixtures/alignSameNetRails"

describe("alignSameNetRails - generalized compatible subsets fallback", () => {
  // Case 1: 3-rail group where 1 branch is blocked by an obstacle (vertical & horizontal)
  describe("Case 1: 3-rail group where 1 branch is blocked by an obstacle", () => {
    const create3RailFixture = (orientation: "vertical" | "horizontal") => {
      const isVert = orientation === "vertical"
      const pins: Array<InputPin & { chipId: string }> = [3, 1, -1, -3].map(
        (val, i) => ({
          pinId: `U1.${i + 1}`,
          chipId: "U1",
          x: isVert ? -1 : val,
          y: isVert ? val : -1,
          _facingDirection: isVert ? ("x-" as const) : ("y-" as const),
        }),
      )

      const inputProblem: InputProblem = {
        chips: [
          {
            chipId: "U1",
            center: { x: 0, y: 0 },
            width: isVert ? 2 : 8,
            height: isVert ? 8 : 2,
            pins,
          },
          {
            chipId: "blocks-bottom-rail",
            center: isVert ? { x: -2.5, y: -2 } : { x: -2, y: -2.5 },
            width: isVert ? 1.4 : 1.0,
            height: isVert ? 1.0 : 1.4,
            pins: [],
          },
        ],
        directConnections: [],
        netConnections: [],
        textBoxes: [],
        availableNetLabelOrientations: {},
      }

      const offsets = [-2, -3, -4]
      const traces = ["top", "middle", "bottom"].map((id, i) => {
        const pinA = pins[i]!
        const pinB = pins[i + 1]!
        const offset = offsets[i]!

        const tracePath = isVert
          ? [
              { x: pinA.x, y: pinA.y },
              { x: offset, y: pinA.y },
              { x: offset, y: pinB.y },
              { x: pinB.x, y: pinB.y },
            ]
          : [
              { x: pinA.x, y: pinA.y },
              { x: pinA.x, y: offset },
              { x: pinB.x, y: offset },
              { x: pinB.x, y: pinB.y },
            ]

        return createTrace(id, tracePath, [pinA, pinB])
      })

      return { inputProblem, traces }
    }

    test("vertical: clear pair aligns and reduces visible length while blocked rail stays in place", () => {
      const { inputProblem, traces } = create3RailFixture("vertical")
      const baselineLength = getVisibleTraceLength(traces)

      const result = align(traces, { inputProblem })

      expect(result.alignedRailGroupCount).toBe(1)
      expect(result.alignedTraceCount).toBe(1)

      // top and middle now share coordinate x = -2
      expect(result.traces[0]!.tracePath[1]!.x).toBe(-2)
      expect(result.traces[1]!.tracePath[1]!.x).toBe(-2)

      // bottom branch remains unaligned at x = -4 beside the obstacle
      expect(result.traces[2]!.tracePath[1]!.x).toBe(-4)

      // Visible trace length is reduced
      const resultLength = getVisibleTraceLength(result.traces)
      expect(resultLength).toBeLessThan(baselineLength)
    })

    test("horizontal: clear pair aligns and reduces visible length while blocked rail stays in place", () => {
      const { inputProblem, traces } = create3RailFixture("horizontal")
      const baselineLength = getVisibleTraceLength(traces)

      const result = align(traces, { inputProblem })

      expect(result.alignedRailGroupCount).toBe(1)
      expect(result.alignedTraceCount).toBe(1)

      // top and middle now share coordinate y = -2
      expect(result.traces[0]!.tracePath[1]!.y).toBe(-2)
      expect(result.traces[1]!.tracePath[1]!.y).toBe(-2)

      // bottom branch remains unaligned at y = -4 beside the obstacle
      expect(result.traces[2]!.tracePath[1]!.y).toBe(-4)

      // Visible trace length is reduced
      const resultLength = getVisibleTraceLength(result.traces)
      expect(resultLength).toBeLessThan(baselineLength)
    })
  })

  // Case 2: 3-rail group with conflicting fixed outer net labels -> inner rail aligns with compatible outer rail
  describe("Case 2: 3-rail group with conflicting fixed outer net labels", () => {
    test("inner rail aligns with compatible outer rail while preserving both label anchors", () => {
      const pins: Array<InputPin & { chipId: string }> = [3, 1, -1, -3].map(
        (y, i) => ({
          pinId: `U1.${i + 1}`,
          chipId: "U1",
          x: -1,
          y,
          _facingDirection: "x-" as const,
        }),
      )

      const inputProblem: InputProblem = {
        chips: [
          {
            chipId: "U1",
            center: { x: 0, y: 0 },
            width: 2,
            height: 8,
            pins,
          },
        ],
        directConnections: [],
        netConnections: [],
        textBoxes: [],
        availableNetLabelOrientations: {},
      }

      const offsets = [-2, -2.1, -2.2]
      const traces = ["rail-0", "rail-1", "rail-2"].map((id, i) => {
        const pinA = pins[i]!
        const pinB = pins[i + 1]!
        const offset = offsets[i]!
        return createTrace(
          id,
          [
            { x: -1, y: pinA.y },
            { x: offset, y: pinA.y },
            { x: offset, y: pinB.y },
            { x: -1, y: pinB.y },
          ],
          [pinA, pinB],
        )
      })

      // Outer labels: rail-0 fixed at x = -2, rail-2 fixed at x = -2.2
      const netLabelPlacements: NetLabelPlacement[] = [
        {
          globalConnNetId: "power-net",
          netId: "POWER",
          mspConnectionPairIds: ["rail-0"],
          pinIds: ["U1.1", "U1.2"],
          orientation: "x+",
          anchorPoint: { x: -2, y: 2 },
          center: { x: -1.8, y: 2 },
          width: 0.4,
          height: 0.2,
        },
        {
          globalConnNetId: "power-net",
          netId: "POWER",
          mspConnectionPairIds: ["rail-2"],
          pinIds: ["U1.3", "U1.4"],
          orientation: "x+",
          anchorPoint: { x: -2.2, y: -2 },
          center: { x: -2, y: -2 },
          width: 0.4,
          height: 0.2,
        },
      ]

      const baselineLength = getVisibleTraceLength(traces)
      const result = align(traces, { inputProblem, netLabelPlacements })

      expect(result.alignedRailGroupCount).toBe(1)
      expect(result.alignedTraceCount).toBe(1)

      // Inner rail (rail-1) aligned with compatible outer rail (rail-0) at x = -2
      expect(result.traces[0]!.tracePath[1]!.x).toBe(-2)
      expect(result.traces[1]!.tracePath[1]!.x).toBe(-2)

      // Incompatible outer rail (rail-2) preserves its anchor at x = -2.2
      expect(result.traces[2]!.tracePath[1]!.x).toBe(-2.2)

      const resultLength = getVisibleTraceLength(result.traces)
      expect(resultLength).toBeLessThan(baselineLength)
    })
  })

  // Case 3: 4-rail group where 1 branch is blocked by an obstacle -> all 3 clear rails align together into a single shared trunk!
  describe("Case 3: 4-rail group where 1 branch is blocked by an obstacle", () => {
    test("all 3 clear rails align together into a single shared trunk (outperforming pairwise-only and 3-trace-only)", () => {
      const pins: Array<InputPin & { chipId: string }> = [4, 2, 0, -2, -4].map(
        (y, i) => ({
          pinId: `U1.${i + 1}`,
          chipId: "U1",
          x: -1,
          y,
          _facingDirection: "x-" as const,
        }),
      )

      const inputProblem: InputProblem = {
        chips: [
          {
            chipId: "U1",
            center: { x: 0, y: 0 },
            width: 2,
            height: 10,
            pins,
          },
          {
            chipId: "barrier-rail-3",
            center: { x: -2.15, y: -3 },
            width: 1.0,
            height: 1.0,
            pins: [],
          },
        ],
        directConnections: [],
        netConnections: [],
        textBoxes: [],
        availableNetLabelOrientations: {},
      }

      const offsets = [-2.0, -2.1, -2.2, -2.3]
      const traces = ["rail-0", "rail-1", "rail-2", "rail-3"].map((id, i) => {
        const pinA = pins[i]!
        const pinB = pins[i + 1]!
        const offset = offsets[i]!
        return createTrace(
          id,
          [
            { x: -1, y: pinA.y },
            { x: offset, y: pinA.y },
            { x: offset, y: pinB.y },
            { x: -1, y: pinB.y },
          ],
          [pinA, pinB],
        )
      })

      const baselineLength = getVisibleTraceLength(traces)
      const result = align(traces, { inputProblem })

      expect(result.alignedRailGroupCount).toBe(1)
      expect(result.alignedTraceCount).toBe(2)

      // All 3 clear rails (rail-0, rail-1, rail-2) share the EXACT same coordinate x = -2.0
      expect(result.traces[0]!.tracePath[1]!.x).toBe(-2.0)
      expect(result.traces[1]!.tracePath[1]!.x).toBe(-2.0)
      expect(result.traces[2]!.tracePath[1]!.x).toBe(-2.0)

      // Blocked rail-3 remains safely at x = -2.3 beside the obstacle
      expect(result.traces[3]!.tracePath[1]!.x).toBe(-2.3)

      // Total visible length decreases significantly due to 3-rail trunk unification
      const resultLength = getVisibleTraceLength(result.traces)
      expect(resultLength).toBeLessThan(baselineLength)
    })
  })
})
