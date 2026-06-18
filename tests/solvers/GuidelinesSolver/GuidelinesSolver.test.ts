import { test, expect } from "bun:test"
import { GuidelinesSolver } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import inputProblem from "../../assets/example01.json"

test("GuidelinesSolver creates correct number of guidelines", () => {
  const solver = new GuidelinesSolver({ inputProblem: inputProblem as any })
  solver.solve()

  // Should have at least boundary guidelines
  expect(solver.guidelines.length).toBeGreaterThanOrEqual(4)
})

test("all guidelines have valid numeric values", () => {
  const solver = new GuidelinesSolver({ inputProblem: inputProblem as any })
  solver.solve()

  for (const guideline of solver.guidelines) {
    if (guideline.orientation === "horizontal") {
      expect(typeof guideline.y).toBe("number")
    } else {
      expect(typeof guideline.x).toBe("number")
    }
  }
})
