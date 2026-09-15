import type { GraphicsObject } from "graphics-debug"

export const mergeGraphicsObjects = (objects: (GraphicsObject | undefined)[]): GraphicsObject => {
  const merged: GraphicsObject = { lines: [], points: [], rects: [], circles: [], texts: [] }
  for (const obj of objects) {
    if (!obj) continue
    if (obj.lines) merged.lines!.push(...obj.lines)
    if (obj.points) merged.points!.push(...obj.points)
    if (obj.rects) merged.rects!.push(...obj.rects)
    if (obj.circles) merged.circles!.push(...obj.circles)
    if (obj.texts) merged.texts!.push(...obj.texts)
  }
  const finalLines: any[] = []
  const T = 0.05
  for (const L of (merged.lines || [])) {
    for (const E of finalLines) {
      if (Math.abs(L.x1 - E.x1) < T && Math.abs(L.x2 - E.x2) < T) { L.x1 = E.x1; L.x2 = E.x1 }
      if (Math.abs(L.y1 - E.y1) < T && Math.abs(L.y2 - E.y2) < T) { L.y1 = E.y1; L.y2 = E.y1 }
    }
    finalLines.push(L)
  }
  merged.lines = finalLines
  return merged
}
