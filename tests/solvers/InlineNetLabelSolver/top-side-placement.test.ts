import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import { InlineNetLabelSolver } from "lib/solvers/InlineNetLabelSolver/InlineNetLabelSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { InputProblem } from "lib/types/InputProblem"

for (const axis of ["x", "y"] as const) {
  for (const route of ["straight", "jog", "terminal"] as const) {
    for (const blocked of [false, true]) {
      test(`${axis}-axis ${route} keeps text above the wire when ${blocked ? "only the opposite side is clear" : "the top side is clear"}`, () => {
        const rotate = ({ x, y }: Point): Point =>
          axis === "x" ? { x, y } : { x: -y, y: x }
        const pinIds = route === "terminal" ? ["U1.1"] : ["U1.1", "U2.1"]
        const inputProblem: InputProblem = {
          chips: [
            {
              chipId: "U1",
              center: rotate({ x: -2, y: 0 }),
              width: 1,
              height: 1,
              pins: [
                {
                  pinId: "U1.1",
                  ...rotate({ x: -1.5, y: 0 }),
                  _facingDirection: axis === "x" ? "x+" : "y+",
                },
              ],
            },
            ...(route === "terminal"
              ? []
              : [
                  {
                    chipId: "U2",
                    center: rotate({ x: 2, y: 0 }),
                    width: 1,
                    height: 1,
                    pins: [{ pinId: "U2.1", ...rotate({ x: 1.5, y: 0 }) }],
                  },
                ]),
          ],
          directConnections: [],
          netConnections: [
            {
              netId: "SIGNAL",
              pinIds,
              allowInlineNetLabel: true,
              inlineNetLabelWidth: route === "jog" ? 1.6 : 0.8,
              inlineNetLabelHeight: 0.12,
            },
          ],
          textBoxes: blocked
            ? [
                {
                  center: rotate({ x: 0, y: 0.2 }),
                  width: axis === "x" ? 3 : 0.3,
                  height: axis === "x" ? 0.3 : 3,
                  text: "obstacle above",
                },
              ]
            : [],
          availableNetLabelOrientations: { SIGNAL: ["x-", "x+"] },
        }
        const path = (
          route === "jog"
            ? [
                { x: -1.5, y: 0 },
                { x: -0.4, y: 0 },
                { x: -0.4, y: -0.1 },
                { x: 0.4, y: -0.1 },
                { x: 0.4, y: 0 },
                { x: 1.5, y: 0 },
              ]
            : [
                { x: -1.5, y: 0 },
                { x: 1.5, y: 0 },
              ]
        ).map(rotate)
        const traces: SolvedTracePath[] =
          route === "terminal"
            ? []
            : [
                {
                  mspPairId: "route",
                  mspConnectionPairIds: ["route"],
                  dcConnNetId: "SIGNAL",
                  globalConnNetId: "SIGNAL",
                  userNetId: "SIGNAL",
                  pinIds,
                  pins: inputProblem.chips.map((chip) => ({
                    ...chip.pins[0]!,
                    chipId: chip.chipId,
                  })) as SolvedTracePath["pins"],
                  tracePath: path,
                },
              ]
        const anchored: NetLabelPlacement = {
          netId: "SIGNAL",
          globalConnNetId: "SIGNAL",
          pinIds,
          mspConnectionPairIds: traces.map((trace) => trace.mspPairId),
          orientation: "x-",
          anchorPoint: rotate({ x: -1.5, y: 0 }),
          center: rotate({ x: -2, y: 0 }),
          width: 0.8,
          height: 0.2,
        }
        const solver = new InlineNetLabelSolver({
          inputProblem,
          traces,
          netLabelPlacements: [anchored],
        })
        solver.solve()
        const output = solver.getOutput()
        expect(solver.solved).toBe(true)
        if (blocked) {
          expect(output.inlineNetLabelPlacements).toHaveLength(0)
          expect(output.netLabelPlacements).toEqual([anchored])
          expect(output.traces).toEqual(traces)
        } else {
          expect(output.inlineNetLabelPlacements).toHaveLength(1)
          const label = output.inlineNetLabelPlacements[0]!
          expect(label.side).toBe(axis === "x" ? "y+" : "x-")
          if (axis === "x")
            expect(label.center.y).toBeGreaterThan(label.anchorPoint.y)
          else expect(label.center.x).toBeLessThan(label.anchorPoint.x)
          expect(output.netLabelPlacements).toHaveLength(0)
        }
      })
    }
  }
}
