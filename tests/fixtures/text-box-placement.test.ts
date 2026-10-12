import { expect, test } from "bun:test"
import { any_circuit_element } from "circuit-json"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "lib/solvers/SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem, TextBoxes } from "lib/types/InputProblem"
import { convertSolverOutputToCircuitJson } from "./convertSolverOutputToCircuitJson"

class TextBoxSolver extends BaseSolver {
  constructor(public inputProblem: InputProblem) {
    super()
  }
  getOutput() {
    return { traces: [], netLabelPlacements: [] }
  }
}

const createInput = (textBox: TextBoxes): InputProblem => ({
  chips: [],
  directConnections: [],
  netConnections: [],
  availableNetLabelOrientations: {},
  textBoxes: [textBox],
})

test.each([
  ["left", "center_left"],
  ["right", "center_right"],
  ["top", "top_center"],
  ["bottom", "bottom_center"],
  ["center", "center"],
  ["bottom_left", "bottom_left"],
] as const)(
  "preserves %s text placement independently of obstacle bounds",
  (anchor, graphicsAnchor) => {
    const input = createInput({
      center: { x: 3, y: 2 },
      width: 5,
      height: 0.4,
      text: "MPN",
      textPlacement: {
        position: { x: 0.6, y: 2.1 },
        anchor,
        fontSize: 0.24,
        rotation: -90,
      },
    })
    const circuitJson = convertSolverOutputToCircuitJson(
      new TextBoxSolver(input),
    )
    const text = circuitJson.find(
      (element) => element.type === "schematic_text",
    )!
    expect(text).toMatchObject({
      position: { x: 0.6, y: 2.1 },
      anchor,
      font_size: 0.24,
      rotation: -90,
    })
    expect(any_circuit_element.safeParse(text).success).toBe(true)

    const graphics = visualizeInputProblem(input)
    expect(graphics.texts).toEqual([
      {
        x: 0.6,
        y: 2.1,
        text: "MPN",
        anchorSide: graphicsAnchor,
        fontSize: 0.24,
        rotation: 90,
        color: "#7e22ce",
      },
    ])
    expect(graphics.rects?.[0]).toMatchObject({
      center: { x: 3, y: 2 },
      width: 5,
      height: 0.4,
    })
    expect(graphics.rects?.[0]?.label).toBeUndefined()
  },
)

test("text boxes without placement retain legacy centered previews", () => {
  const input = createInput({
    center: { x: 3, y: 2 },
    width: 5,
    height: 0.4,
    text: "MPN",
  })
  const circuitJson = convertSolverOutputToCircuitJson(new TextBoxSolver(input))
  expect(
    circuitJson.find((element) => element.type === "schematic_text"),
  ).toMatchObject({
    position: { x: 3, y: 2 },
    anchor: "center",
    font_size: 0.18,
    rotation: 0,
  })
  const graphics = visualizeInputProblem(input)
  expect(graphics.rects?.[0]?.label).toBe("MPN")
  expect(graphics.texts ?? []).toHaveLength(0)
})
