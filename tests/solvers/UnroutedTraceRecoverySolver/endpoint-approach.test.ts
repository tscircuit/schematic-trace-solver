import { expect, test } from "bun:test"
import type { MspConnectionPair } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import { findFirstCollision } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { getObstacleRects } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/rect"
import { UnroutedTraceRecoverySolver } from "lib/solvers/UnroutedTraceRecoverySolver/UnroutedTraceRecoverySolver"
import type { InputProblem } from "lib/types/InputProblem"
import { dir, type FacingDirection } from "lib/utils/dir"

for (const facing of ["x+", "x-", "y+", "y-"] as FacingDirection[]) {
  test.each([false, true])(
    `recovery clears endpoint bodies facing ${facing} (reversed=%s)`,
    (reversed) => {
      const outward = dir(facing)
      const problem: InputProblem = {
        chips: [0, 1].map((index) => ({
          chipId: `part${index}`,
          center: {
            x: index * outward.x - index * 0.035 * outward.y,
            y: index * outward.y + index * 0.035 * outward.x,
          },
          width: 0.6,
          height: 0.6,
          pins: [
            {
              pinId: `pin${index}`,
              x: (index + 0.3) * outward.x - index * 0.035 * outward.y,
              y: (index + 0.3) * outward.y + index * 0.035 * outward.x,
              _facingDirection: facing,
            },
          ],
        })),
        directConnections: [{ pinIds: ["pin0", "pin1"] }],
        netConnections: [],
        availableNetLabelOrientations: {},
        maxMspPairDistance: 2,
      }
      const pins = problem.chips.map((chip) => ({
        ...chip.pins[0]!,
        chipId: chip.chipId,
      })) as MspConnectionPair["pins"]
      const connectedPin = pins[1]
      if (reversed) pins.reverse()
      const solver = new UnroutedTraceRecoverySolver({
        inputProblem: problem,
        failedConnectionPairs: [
          {
            mspPairId: "pair",
            dcConnNetId: "signal",
            globalConnNetId: "signal",
            pins,
          },
        ],
        alreadySolvedTraces: [
          {
            mspPairId: "existing",
            mspConnectionPairIds: ["existing"],
            dcConnNetId: "signal",
            globalConnNetId: "signal",
            pins: [connectedPin, connectedPin],
            pinIds: [connectedPin.pinId],
            tracePath: [
              connectedPin,
              {
                x: connectedPin.x + 0.2 * outward.x,
                y: connectedPin.y + 0.2 * outward.y,
              },
            ],
          },
        ],
      })
      solver.solve()

      expect(solver.solvedUnroutedTraces).toHaveLength(1)
      const path = solver.solvedUnroutedTraces[0]!.tracePath
      expect(path[0]).toMatchObject(problem.chips[0]!.pins[0]!)
      const interiors = getObstacleRects(problem).map((bounds) => ({
        minX: bounds.minX + 1e-6,
        maxX: bounds.maxX - 1e-6,
        minY: bounds.minY + 1e-6,
        maxY: bounds.maxY - 1e-6,
      }))
      expect(findFirstCollision(path, interiors)).toBeNull()
    },
  )
}
