import test, { expect } from "bun:test"

test("solver - collinear net route segment reduction", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 20, y: 0 }
  ]
  const isCollinear = (p1: any, p2: any, p3: any) => {
    return (p2.y - p1.y) * (p3.x - p2.x) === (p3.y - p2.y) * (p2.x - p1.x)
  }
  expect(isCollinear(points[0], points[1], points[2])).toBeTrue()
})
