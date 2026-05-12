import type { GraphicsObject } from "graphics-debug"

/**
 * Merges multiple GraphicsObject instances into a single GraphicsObject.
 * It combines all lines, points, rectangles, circles, and texts from the input objects.
 */
export const mergeGraphicsObjects = (
  objects: (GraphicsObject | undefined)[],
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
    if (obj.lines) merged.lines!.push(...obj.lines)
    if (obj.points) merged.points!.push(...obj.points)
    if (obj.rects) merged.rects!.push(...obj.rects)
    if (obj.circles) merged.circles!.push(...obj.circles)
    if (obj.texts) merged.texts!.push(...obj.texts)
  }

  return merged
}
