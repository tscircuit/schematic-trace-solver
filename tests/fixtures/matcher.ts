import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { expect, type MatcherResult } from "bun:test"
import type { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { colorAvailableNetOrientationLabels } from "lib/solvers/SchematicTracePipelineSolver/colorAvailableNetOrientationLabels"
import type { InputProblem } from "lib/types/InputProblem"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { stackSvgsHorizontally } from "stack-svgs"
import {
  convertSolverOutputToCircuitJson,
  getInputProblemFromSolver,
} from "./convertSolverOutputToCircuitJson"

const getAllElms = (graphicsObject: GraphicsObject) => {
  return [
    ...(graphicsObject.lines ?? []),
    ...(graphicsObject.points ?? []),
    ...(graphicsObject.rects ?? []),
    ...(graphicsObject.circles ?? []),
    ...(graphicsObject.texts ?? []),
  ]
}

const getLegacySolverSvg = (
  received: BaseSolver,
  inputProblem?: InputProblem,
) => {
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

  if (received.solved && inputProblem) {
    colorAvailableNetOrientationLabels(graphicsObject, inputProblem)
  }

  return getSvgFromGraphicsObject(graphicsObject, {
    backgroundColor: "white",
  }).replace(/[ \t]+$/gm, "")
}

async function toMatchSolverSnapshot(
  this: any,
  received: BaseSolver,
  testPathOriginal: string,
  svgName?: string,
): Promise<MatcherResult> {
  const inputProblem = getInputProblemFromSolver(received)
  if (inputProblem) {
    const circuitJson = convertSolverOutputToCircuitJson(received)
    const circuitJsonSvg = convertCircuitJsonToSchematicSvg(circuitJson, {
      width: 1200,
      height: 800,
    }).replace(/[ \t]+$/gm, "")
    const legacySvg = getLegacySolverSvg(received, inputProblem)
    const svg = stackSvgsHorizontally([legacySvg, circuitJsonSvg], {
      gap: 16,
      normalizeSize: true,
      targetSize: 1200,
      rootAttributes: {
        role: "img",
        "aria-label":
          "Solver debug visualization on the left and Circuit JSON schematic on the right",
      },
    })

    return expect(svg).toMatchSvgSnapshot(testPathOriginal, svgName)
  }

  // Keep a graphics-debug fallback for solver snapshots that do not expose an
  // InputProblem. Semantic Circuit JSON rendering is the default.
  const fallbackInputProblem = getInputProblem(received)
  const svg = getLegacySolverSvg(received, fallbackInputProblem)

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
