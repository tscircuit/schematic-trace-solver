import type { GraphicsObject } from "graphics-debug"

const graphicsObjectKeys = [
  "lines",
  "points",
  "circles",
  "rects",
  "texts",
] as const

type GraphicsObjectKey = (typeof graphicsObjectKeys)[number]

export function getLastStepGraphicsObject(
  graphicsObject: GraphicsObject,
): GraphicsObject {
  const steps = new Set<number>()

  for (const key of graphicsObjectKeys) {
    for (const object of (graphicsObject[key] ?? []) as Array<{
      step?: number
    }>) {
      if (typeof object.step === "number") steps.add(object.step)
    }
  }

  const maxStep = Math.max(...steps, -1)
  if (maxStep === -1) return graphicsObject

  const lastStepGraphicsObject: GraphicsObject = {}

  for (const key of graphicsObjectKeys) {
    const objects = graphicsObject[key] as Array<{ step?: number }> | undefined
    ;(lastStepGraphicsObject as Record<GraphicsObjectKey, unknown>)[key] =
      objects?.filter((object) => object.step === maxStep) ?? []
  }

  return lastStepGraphicsObject
}
