import { expect, test } from "bun:test"
import { SchematicTraceSingleLineSolver2 } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/SchematicTraceSingleLineSolver2"
import type { InputChip, InputProblem } from "lib/types/InputProblem"

const getOrthogonalPathLength = (points: Array<{ x: number; y: number }>) =>
  points.slice(0, -1).reduce((length, point, pointIndex) => {
    const nextPoint = points[pointIndex + 1]!
    return (
      length + Math.abs(nextPoint.x - point.x) + Math.abs(nextPoint.y - point.y)
    )
  }, 0)

test("repro47 uses a minimal route between nearby opposing pins", async () => {
  const diode: InputChip = {
    chipId: "D2",
    center: { x: 3.2, y: 0.095 },
    width: 0.4,
    height: 0.2,
    pins: [{ pinId: "D2.cathode", x: 3.4, y: 0.095 }],
  }
  const pushButton: InputChip = {
    chipId: "SW2",
    center: { x: 3.81, y: 0.045 },
    width: 0.4,
    height: 0.2,
    pins: [{ pinId: "SW2.pin1", x: 3.61, y: 0.045 }],
  }
  const pins: ConstructorParameters<
    typeof SchematicTraceSingleLineSolver2
  >[0]["pins"] = [
    {
      pinId: "D2.cathode",
      chipId: diode.chipId,
      x: 3.4,
      y: 0.095,
      _facingDirection: "x+" as const,
    },
    {
      pinId: "SW2.pin1",
      chipId: pushButton.chipId,
      x: 3.61,
      y: 0.045,
      _facingDirection: "x-" as const,
    },
  ]
  const inputProblem: InputProblem = {
    chips: [diode, pushButton],
    directConnections: [{ pinIds: [pins[0].pinId, pins[1].pinId] }],
    netConnections: [],
    availableNetLabelOrientations: {},
  }
  const solver = new SchematicTraceSingleLineSolver2({
    pins,
    chipMap: { [diode.chipId]: diode, [pushButton.chipId]: pushButton },
    inputProblem,
  })

  solver.solve()

  expect(solver.solved).toBe(true)
  expect(getOrthogonalPathLength(solver.solvedTracePath!)).toBeCloseTo(0.26)
  await expect(solver).toMatchSolverSnapshot(import.meta.path)
})
