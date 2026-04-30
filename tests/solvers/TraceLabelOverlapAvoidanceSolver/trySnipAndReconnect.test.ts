import { test, expect } from "bun:test"

test("generateSnipAndReconnectCandidates module exports function", async () => {
  const module = await import(
    "lib/solvers/TraceLabelOverlapAvoidanceSolver/trySnipAndReconnect"
  )
  expect(typeof module.generateSnipAndReconnectCandidates).toBe("function")
})
