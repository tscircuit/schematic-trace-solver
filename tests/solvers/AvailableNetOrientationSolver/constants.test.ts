import { test, expect, describe } from "bun:test"
import {
  LABEL_SEARCH_STEP,
  WICK_CLEARANCE,
  EPS,
  TRACE_BOUNDARY_TOLERANCE,
  CANDIDATE_SELECTED_COLOR,
  CANDIDATE_REJECTED_COLOR,
} from "lib/solvers/AvailableNetOrientationSolver/constants"

describe("constants", () => {
  test("LABEL_SEARCH_STEP is defined", () => {
    expect(LABEL_SEARCH_STEP).toBe(0.05)
  })

  test("WICK_CLEARANCE is defined", () => {
    expect(WICK_CLEARANCE).toBe(0.001)
  })

  test("EPS is defined", () => {
    expect(EPS).toBe(1e-9)
  })

  test("TRACE_BOUNDARY_TOLERANCE is WICK_CLEARANCE + EPS", () => {
    expect(TRACE_BOUNDARY_TOLERANCE).toBe(WICK_CLEARANCE + EPS)
  })

  test("CANDIDATE_SELECTED_COLOR is blue", () => {
    expect(CANDIDATE_SELECTED_COLOR).toBe("blue")
  })

  test("CANDIDATE_REJECTED_COLOR is red", () => {
    expect(CANDIDATE_REJECTED_COLOR).toBe("red")
  })
})
