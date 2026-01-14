import { getSvgFromGraphicsObject, type GraphicsObject } from "graphics-debug"
import { expect, type MatcherResult } from "bun:test"
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

const renderGraphicsToSvg = (
  graphicsObject: GraphicsObject,
  opts?: { includeAirwires?: boolean },
) => {
  const includeAirwires = opts?.includeAirwires ?? true

  const filteredGraphics: GraphicsObject = includeAirwires
    ? graphicsObject
    : {
        ...graphicsObject,
        lines: (graphicsObject.lines ?? []).filter(
          (line) =>
            !(
              typeof line.strokeColor === "string" &&
              line.strokeColor.startsWith("hsl(")
            ),
        ),
      }

  const svg = getSvgFromGraphicsObject(filteredGraphics, {
    backgroundColor: "white",
  })

  if (!includeAirwires) {
    return svg.replace(/data-type="line"/g, 'data-type="trace"')
  }

  return svg
}

async function toMatchSolverSnapshot(
  this: any,
  received: BaseSolver,
  testPathOriginal: string,
  svgNameOrOpts?: string | { includeAirwires?: boolean },
  maybeOpts?: { includeAirwires?: boolean },
): Promise<MatcherResult> {
  const graphicsObject = received.visualize()
  const svgName = typeof svgNameOrOpts === "string" ? svgNameOrOpts : undefined
  const opts =
    typeof svgNameOrOpts === "object" && svgNameOrOpts !== null
      ? svgNameOrOpts
      : (maybeOpts ?? {})

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

  const isExampleTest =
    testPathOriginal.includes("/examples/") ||
    testPathOriginal.includes("\\examples\\")

  if (
    process.env.DEBUG_BOX_FILTER === "1" &&
    isExampleTest &&
    graphicsObject.lines?.length
  ) {
    const exampleId =
      testPathOriginal.match(/example\d+/i)?.[0] ?? testPathOriginal
    const purpleLines = graphicsObject.lines.filter(
      (line) => line.strokeColor === "purple",
    )
    for (const line of purpleLines) {
      const pts = line.points ?? []
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]!
        const b = pts[i + 1]!
        console.log(
          `[Solver2][${exampleId}] segment ${a.x},${a.y} -> ${b.x},${b.y}`,
        )
      }
    }
  }

  const svg = renderGraphicsToSvg(graphicsObject, {
    includeAirwires: opts.includeAirwires ?? !isExampleTest,
  })

  return expect(svg).toMatchSvgSnapshot(testPathOriginal, svgName)
}

expect.extend({
  toMatchSolverSnapshot: toMatchSolverSnapshot as any,
})

declare module "bun:test" {
  interface Matchers<T = unknown> {
    toMatchSolverSnapshot(
      testPath: string,
      svgNameOrOpts?: string | { includeAirwires?: boolean },
      opts?: { includeAirwires?: boolean },
    ): Promise<MatcherResult>
  }
}
