import { expect, test } from "bun:test"
import { countTurns } from "lib/solvers/TraceCleanupSolver/countTurns"

test("countTurns treats a straight run with float drift as no turn", () => {
  // Typical drift from chained += offset math elsewhere in the pipeline
  // (e.g. TraceOverlapIssueSolver's jog application) - geometrically this
  // is a straight vertical run, not a turn.
  const drifted = [
    { x: 1, y: 0 },
    { x: 1.0000000001, y: 1 },
    { x: 1.0000000001, y: 2 },
  ]

  expect(countTurns(drifted)).toBe(0)
})

test("countTurns returns 0 for a perfectly straight vertical run", () => {
  const straight = [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 1, y: 2 },
  ]

  expect(countTurns(straight)).toBe(0)
})

test("countTurns counts a single L-shaped turn", () => {
  const lShape = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]

  expect(countTurns(lShape)).toBe(1)
})

test("countTurns counts both turns in a Z-shape", () => {
  const zShape = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ]

  expect(countTurns(zShape)).toBe(2)
})

test("countTurns still counts a real turn well above the drift tolerance", () => {
  const realTurn = [
    { x: 1, y: 0 },
    { x: 1.01, y: 1 },
    { x: 1.01, y: 2 },
  ]

  expect(countTurns(realTurn)).toBe(1)
})
