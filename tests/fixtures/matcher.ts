import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { expect, type MatcherResult } from "bun:test"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { colorAvailableNetOrientationLabels } from "lib/solvers/SchematicTracePipelineSolver/colorAvailableNetOrientationLabels"
import type { InputProblem } from "lib/types/InputProblem"

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
  const graphicsObject = received.visualize()

  const allElms = getAllElms(graphicsObject)
  const lastStep = allElms.reduce((acc, elm) => {
    return Math.max(acc, elm.step ?? 0)
  }, 0)

  if (lastStep !== 0) {
    graphicsObject.points = graphicsObject.points?.filter(
      (p) => p.step === lastStep,
    )
    graphicsObject.lines = graphicsObject.lines?.filter(
      (l) => l.step === lastStep,
    )
    graphicsObject.rects = graphicsObject.rects?.filter(
      (r) => r.step === lastStep,
    )
    graphicsObject.circles = graphicsObject.circles?.filter(
      (c) => c.step === lastStep,
    )
    graphicsObject.texts = graphicsObject.texts?.filter(
      (t) => t.step === lastStep,
    )
  }

  const inputProblem = getInputProblem(received)
  if (received.solved && inputProblem) {
    colorAvailableNetOrientationLabels(graphicsObject, inputProblem)
  }

  // Normalize graphics object to avoid snapshot flakiness
  const round = (val: number | undefined) =>
    val !== undefined ? Math.round(val * 100) / 100 : undefined

  if (graphicsObject.lines) {
    graphicsObject.lines.forEach((l: any) => {
      l.x1 = round(l.x1)!
      l.y1 = round(l.y1)!
      l.x2 = round(l.x2)!
      l.y2 = round(l.y2)!
      if (l.x1 > l.x2 || (l.x1 === l.x2 && l.y1 > l.y2)) {
        const tx = l.x1
        l.x1 = l.x2
        l.x2 = tx
        const ty = l.y1
        l.y1 = l.y2
        l.y2 = ty
      }
    })
    graphicsObject.lines.sort(
      (a: any, b: any) =>
        a.x1 - b.x1 ||
        a.y1 - b.y1 ||
        a.x2 - b.x2 ||
        a.y2 - b.y2 ||
        (a.color || "").localeCompare(b.color || ""),
    )
  }

  if (graphicsObject.points) {
    graphicsObject.points.forEach((p: any) => {
      p.x = round(p.x)!
      p.y = round(p.y)!
    })
    graphicsObject.points.sort((a: any, b: any) => a.x - b.x || a.y - b.y)
  }

  if (graphicsObject.texts) {
    graphicsObject.texts.forEach((t: any) => {
      t.x = round(t.x)!
      t.y = round(t.y)!
    })
    graphicsObject.texts.sort(
      (a: any, b: any) =>
        a.x - b.x || a.y - b.y || (a.text || "").localeCompare(b.text || ""),
    )
  }

  if (graphicsObject.rects) {
    graphicsObject.rects.forEach((r: any) => {
      r.x = round(r.x)!
      r.y = round(r.y)!
      r.width = round(r.width)!
      r.height = round(r.height)!
    })
    graphicsObject.rects.sort((a: any, b: any) => a.x - b.x || a.y - b.y)
  }

  const svg = getSvgFromGraphicsObject(graphicsObject, {
    backgroundColor: "white",
  })

  return expect(svg).toMatchSvgSnapshot(testPathOriginal, svgName)
}

const getInputProblem = (solver: BaseSolver): InputProblem | undefined => {
  const maybeSolver = solver as BaseSolver & {
    inputProblem?: InputProblem
    input?: { inputProblem?: InputProblem }
    params?: { inputProblem?: InputProblem }
  }

  return (
    maybeSolver.inputProblem ??
    maybeSolver.input?.inputProblem ??
    maybeSolver.params?.inputProblem
  )
}

expect.extend({
  toMatchSolverSnapshot: toMatchSolverSnapshot as any,
})

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchSolverSnapshot(
      testPath: string,
      svgName?: string,
    ): Promise<MatcherResult>
  }
}
