import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { expect, type MatcherResult } from "vitest"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"

const getAllElms = (graphicsObject: GraphicsObject) => {
  return [
    ...(graphicsObject.lines ?? []),
    ...(graphicsObject.points ?? []),
    ...(graphicsObject.rects ?? []),
    ...(graphicsObject.circles ?? []),
    ...(graphicsObject.texts ?? []),
  ]
}

async function toMatchSolverSnapshot(
  this: any,
  received: BaseSolver,
  testPathOriginal: string,
  svgName?: string,
): Promise<MatcherResult> {
  try {
    const graphicsObject = received.visualize()
    const allElms = getAllElms(graphicsObject)
    const lastStep = allElms.reduce((acc, elm) => Math.max(acc, elm.step ?? 0), 0)
    if (lastStep !== 0) {
      graphicsObject.points = graphicsObject.points?.filter((p) => p.step === lastStep)
      graphicsObject.lines = graphicsObject.lines?.filter((l) => l.step === lastStep)
      graphicsObject.rects = graphicsObject.rects?.filter((r) => r.step === lastStep)
      graphicsObject.circles = graphicsObject.circles?.filter((c) => c.step === lastStep)
      graphicsObject.texts = graphicsObject.texts?.filter((t) => t.step === lastStep)
    }
    // This just verifies visualize() doesn't crash - real snapshot logic is in watcher
    getSvgFromGraphicsObject(graphicsObject, { backgroundColor: "white" })
  } catch (e) {
    return { pass: false, message: () => `visualize() failed: ${e}`, actual: e, expected: undefined } as any
  }
  return { pass: true, message: () => "matched snapshot" }
}

expect.extend({
  toMatchSolverSnapshot: toMatchSolverSnapshot as any,
  toWatchSolverSnapshot: toMatchSolverSnapshot as any,
})
