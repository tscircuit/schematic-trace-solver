import { test, expect } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "../assets/example41.json"
import "tests/fixtures/matcher"

test("example41", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  const labels = solver.netLabelNetLabelCollisionSolver!.outputNetLabelPlacements

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!
      const b = labels[j]!
      if (a.globalConnNetId === b.globalConnNetId) continue
      const ba = {
        minX: a.center.x - a.width / 2,
        maxX: a.center.x + a.width / 2,
        minY: a.center.y - a.height / 2,
        maxY: a.center.y + a.height / 2,
      }
      const bb = {
        minX: b.center.x - b.width / 2,
        maxX: b.center.x + b.width / 2,
        minY: b.center.y - b.height / 2,
        maxY: b.center.y + b.height / 2,
      }
      const collides =
        ba.minX < bb.maxX &&
        ba.maxX > bb.minX &&
        ba.minY < bb.maxY &&
        ba.maxY > bb.minY
      expect(collides).toBe(false)
    }
  }

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
