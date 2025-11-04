import type { Point } from "@tscircuit/math-utils"

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface RectangleCandidate {
  rect: Rectangle
  i1: Point
  i2: Point
}

export const generateRectangleCandidates = (
  intersections1: Point[],
  intersections2: Point[],
): RectangleCandidate[] => {
  const rectangleCandidates: RectangleCandidate[] = []

  for (const p1 of intersections1) {
    for (const p2 of intersections2) {
      const minX = Math.min(p1.x, p2.x)
      const minY = Math.min(p1.y, p2.y)
      const maxX = Math.max(p1.x, p2.x)
      const maxY = Math.max(p1.y, p2.y)

      const width = maxX - minX
      const height = maxY - minY

      // Ensure the rectangle has a non-zero area
      if (width > 1e-6 && height > 1e-6) {
        rectangleCandidates.push({
          rect: {
            x: minX,
            y: minY,
            width,
            height,
          },
          i1: p1,
          i2: p2,
        })
      }
    }
  }

  return rectangleCandidates
}
