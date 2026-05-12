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
