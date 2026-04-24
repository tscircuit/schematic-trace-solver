import type { GraphicsObject } from "graphics-debug"

/**
 * Merges multiple GraphicsObject instances into a single GraphicsObject. It combines all lines, points, rectangles, circles, and texts from the input objects.
 */
export const mergeGraphicsObjects = (
  objects: (GraphicsObject | undefined)[]
): GraphicsObject => {
  const merged: GraphicsObject = {
    lines: [],
    points: [],
    rects: [],
    circles: [],
    texts: [],
  }

  for (const obj of objects) {
    if (!obj) continue
    if (obj.lines) merged.lines.push(...obj.lines)
    if (obj.points) merged.points.push(...obj.points)
    if (obj.rects) merged.rects.push(...obj.rects)
    if (obj.circles) merged.circles.push(...obj.circles)
    if (obj.texts) merged.texts.push(...obj.texts)
  }

  return merged
}

// Add test to verify functionality

const check = () => {
  const obj1: GraphicsObject = { lines: [{ x: 0, y: 0 }, { x: 2, y: 2 }] }
  const obj2: GraphicsObject = { points: [{ x: 3, y: 4 }], rects: [{ width: 5, height: 6 }] }

  const expected: GraphicsObject = {
    lines: [{ x: 0, y: 0 }, { x: 2, y: 2 }],
    points: [{ x: 3, y: 4 }],
    rects: [{ width: 5, height: 6 }],
  }

  const result: GraphicsObject = mergeGraphicsObjects([obj1, obj2])

  expect(result).toEqual(expected)
}