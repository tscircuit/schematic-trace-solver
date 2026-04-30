import { test, expect } from "bun:test"
import { visualizeTightRectangle } from "lib/solvers/TraceCleanupSolver/visualizeTightRectangle"

test("visualizeTightRectangle exports function", async () => {
  const module = await import(
    "lib/solvers/TraceCleanupSolver/visualizeTightRectangle"
  )
  expect(typeof module.visualizeTightRectangle).toBe("function")
})

test("visualizeTightRectangle returns GraphicsObject with rects", () => {
  const rect = { x: 0, y: 0, width: 10, height: 5 }
  const result = visualizeTightRectangle(rect as any)
  expect(result.rects).toBeDefined()
  expect(result.rects).toHaveLength(1)
  expect(result.rects![0].width).toBe(10)
  expect(result.rects![0].height).toBe(5)
})
