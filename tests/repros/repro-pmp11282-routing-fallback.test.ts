import { expect, test } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { InputProblem } from "lib/types/InputProblem"
import "tests/fixtures/matcher"
import inputProblemJson from "./assets/repro-pmp11282-routing-fallback.input.json"

test("repro PMP11282 creates duplicate route pairs for one electrical group", () => {
  const inputProblem: InputProblem = JSON.parse(
    JSON.stringify(inputProblemJson),
  )
  const solver = new MspConnectionPairSolver({ inputProblem })

  solver.solve()

  const uniquePairIds = new Set(
    solver.mspConnectionPairs.map((pair) => pair.mspPairId),
  )
  expect(inputProblem.chips).toHaveLength(112)
  expect(inputProblem.directConnections).toHaveLength(163)
  expect(solver.solved).toBe(true)
  expect(solver.mspConnectionPairs).toHaveLength(583)
  expect(uniquePairIds.size).toBe(203)
  expect(solver).toMatchSolverSnapshot(import.meta.path)
}, 30_000)
