import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputChip, InputProblem } from "lib/types/InputProblem"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getBounds, type GraphicsObject } from "graphics-debug"
import { getGeneratorForAllChipPairs } from "./getGeneratorForAllChipPairs"
import { getInputChipBounds } from "./getInputChipBounds"
import { getHorizontalGuidelineY } from "./getHorizontalGuidelineY"
import { getVerticalGuidelineX } from "./getVerticalGuidelineX"

export type Guideline =
  | {
      orientation: "horizontal"
      y: number
      x: undefined
    }
  | {
      orientation: "vertical"
      y: undefined
      x: number
    }

export class GuidelinesSolver extends BaseSolver {
  inputProblem: InputProblem
  guidelines: Guideline[]

  chipPairsGenerator: Generator<readonly [InputChip, InputChip]>

  usedXGuidelines: Set<number>
  usedYGuidelines: Set<number>

  constructor(params: {
    inputProblem: InputProblem
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.guidelines = []
    this.chipPairsGenerator = getGeneratorForAllChipPairs(
      this.inputProblem.chips,
    )

    this.usedXGuidelines = new Set()
    this.usedYGuidelines = new Set()
  }

  override getConstructorParams(): ConstructorParameters<
    typeof GuidelinesSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
    }
  }

  override _step() {
    const { done, value: chipPair } = this.chipPairsGenerator.next()
    if (done) {
      this.solved = true
      return
    }

    const [chip1, chip2] = chipPair

    const chip1Bounds = getInputChipBounds(chip1)
    const chip2Bounds = getInputChipBounds(chip2)

    const horizontalGuidelineY = getHorizontalGuidelineY(
      chip1Bounds,
      chip2Bounds,
    )
    const verticalGuidelineX = getVerticalGuidelineX(chip1Bounds, chip2Bounds)

    if (!this.usedYGuidelines.has(horizontalGuidelineY)) {
      this.usedYGuidelines.add(horizontalGuidelineY)
      this.guidelines.push({
        orientation: "horizontal",
        y: horizontalGuidelineY,
        x: undefined,
      })
    }

    if (!this.usedXGuidelines.has(verticalGuidelineX)) {
      this.usedXGuidelines.add(verticalGuidelineX)
      this.guidelines.push({
        orientation: "vertical",
        y: undefined,
        x: verticalGuidelineX,
      })
    }
  }

  override visualize(): GraphicsObject {
    const graphics = visualizeInputProblem(this.inputProblem)

    const bounds = getBounds(graphics)
    const boundsWidth = bounds.maxX - bounds.minX
    const boundsHeight = bounds.maxY - bounds.minY
    bounds.minX -= boundsWidth * 0.3
    bounds.maxX += boundsWidth * 0.3
    bounds.minY -= boundsHeight * 0.3
    bounds.maxY += boundsHeight * 0.3

    for (const guideline of this.guidelines) {
      if (guideline.orientation === "horizontal") {
        graphics.lines!.push({
          points: [
            {
              x: bounds.minX,
              y: guideline.y,
            },
            {
              x: bounds.maxX,
              y: guideline.y,
            },
          ],
          strokeColor: "rgba(0, 0, 0, 0.5)",
          strokeDash: "2 2",
        })
      }

      if (guideline.orientation === "vertical") {
        graphics.lines!.push({
          points: [
            {
              x: guideline.x,
              y: bounds.minY,
            },
            {
              x: guideline.x,
              y: bounds.maxY,
            },
          ],
          strokeColor: "rgba(0, 0, 0, 0.5)",
          strokeDash: "2 2",
        })
      }
    }
    return graphics
  }
}
