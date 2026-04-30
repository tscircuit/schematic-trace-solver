import { test, expect } from "bun:test"

test("applyJogToTerminalSegment exports function", async () => {
  const module = await import(
    "lib/solvers/TraceOverlapShiftSolver/TraceOverlapIssueSolver/applyJogToTrace"
  )
  expect(typeof module.applyJogToTerminalSegment).toBe("function")
})
