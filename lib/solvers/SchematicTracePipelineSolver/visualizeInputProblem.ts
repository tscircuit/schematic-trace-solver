import type { GraphicsObject } from "graphics-debug"
import type { InputProblem } from "lib/types/InputProblem"

export const visualizeInputProblem = (
  inputProblem: InputProblem,
): GraphicsObject => {
  const graphics: Pick<
    Required<GraphicsObject>,
    "lines" | "points" | "rects"
  > = {
    lines: [],
    points: [],
    rects: [],
  }

  // TODO

  return graphics
}
