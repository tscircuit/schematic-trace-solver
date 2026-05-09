import { test, expect } from "bun:test"
import { MspConnectionPairSolver } from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import inputProblem from "../../assets/example01.json"

test("MspConnectionPairSolver initializes correctly", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputProblem as any,
  })
  expect(solver).toBeDefined()
  expect(solver.failed).toBe(false)
})

test("MspConnectionPairSolver solves without error", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputProblem as any,
  })
  solver.solve()
  expect(solver.solved).toBe(true)
  expect(solver.failed).toBe(false)
})

test("MspConnectionPairSolver returns mspConnectionPairs", () => {
  const solver = new MspConnectionPairSolver({
    inputProblem: inputProblem as any,
  })
  solver.solve()
  expect(solver.mspConnectionPairs).toBeDefined()
  expect(Array.isArray(solver.mspConnectionPairs)).toBe(true)
})
