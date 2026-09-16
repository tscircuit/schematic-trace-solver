import { expect, test } from "bun:test"
import { shortenNetLabelConnectorsNearTraces } from "lib/solvers/InlineNetLabelSolver/shortenNetLabelConnectorsNearTraces"
import { getAnchoredNetLabelRenderedBounds } from "lib/solvers/InlineNetLabelSolver/getAnchoredNetLabelRenderedBounds"
import { getShaftPositionLabelClearanceInput } from "tests/repros/assets/repro-rp2040-shaft-position-label-clearance.input"

const getInput = () => ({
  ...getShaftPositionLabelClearanceInput(),
  inlineNetLabelPlacements: [],
})

for (const gap of [0, 0.001, -0.2]) {
  test(`shortens a connector at a foreign wire with gap ${gap}`, () => {
    const input = getInput()
    const label = input.netLabelPlacements[0]!
    label.anchorPoint.y = input.traces[0]!.tracePath[1]!.y + gap
    label.center.y = label.anchorPoint.y - 0.09
    input.traces[1]!.tracePath[1] = { ...label.anchorPoint }
    const result = shortenNetLabelConnectorsNearTraces(input)
    expect(result.movedLabelCount).toBe(1)
    expect(
      getAnchoredNetLabelRenderedBounds(result.netLabelPlacements[0]!).minY,
    ).toBeGreaterThan(0.639)
    expect(result.traces[0]).toEqual(input.traces[0])
  })
}

test("handles horizontal connectors and reversed endpoint order", () => {
  const input = getInput()
  // Rotate all geometry 90 degrees; the tag now faces right.
  const rotate = (point: { x: number; y: number }) => ({
    x: -point.y,
    y: point.x,
  })
  for (const chip of input.inputProblem.chips) {
    chip.center = rotate(chip.center)
    ;[chip.width, chip.height] = [chip.height, chip.width]
    for (const pin of chip.pins) Object.assign(pin, rotate(pin))
  }
  for (const box of input.inputProblem.textBoxes!) {
    box.center = rotate(box.center)
    ;[box.width, box.height] = [box.height, box.width]
  }
  for (const trace of input.traces)
    trace.tracePath = trace.tracePath.map(rotate)
  input.traces[1]!.tracePath.reverse()
  const label = input.netLabelPlacements[0]!
  label.anchorPoint = rotate(label.anchorPoint)
  label.orientation = "x+"
  label.center = {
    x: label.anchorPoint.x + label.width / 2,
    y: label.anchorPoint.y,
  }
  const result = shortenNetLabelConnectorsNearTraces(input)
  expect(result.movedLabelCount).toBe(1)
  expect(
    getAnchoredNetLabelRenderedBounds(result.netLabelPlacements[0]!).maxX,
  ).toBeLessThan(-0.639)
  expect(result.traces[1]!.tracePath[0]).toEqual(
    result.netLabelPlacements[0]!.anchorPoint,
  )
  expect(result.traces[1]!.tracePath[1]).toEqual(input.traces[1]!.tracePath[1])
})

test("does not move labels for unregistered traces or same-net contact", () => {
  const input = getInput()
  input.netLabelConnectorTraceIds.clear()
  expect(shortenNetLabelConnectorsNearTraces(input).traces).toEqual(
    input.traces,
  )
  input.netLabelConnectorTraceIds.add(input.traces[1]!.mspPairId)
  input.traces[0]!.globalConnNetId = "ENC_SCL"
  expect(shortenNetLabelConnectorsNearTraces(input).movedLabelCount).toBe(0)
})

test("leaves the original placement when no unobstructed shorter tag fits", () => {
  const input = getInput()
  input.inputProblem.textBoxes!.push({
    center: { x: -9, y: 1.3 },
    width: 0.5,
    height: 1.2,
  })
  const result = shortenNetLabelConnectorsNearTraces(input)
  expect(result.movedLabelCount).toBe(0)
  expect(result.netLabelPlacements).toEqual(input.netLabelPlacements)
  expect(result.traces).toEqual(input.traces)
})

test("does not shorten away a same-net branch attached to the connector", () => {
  const input = getInput()
  input.traces.push({
    ...input.traces[1]!,
    mspPairId: "same-net-branch",
    tracePath: [
      { x: -9, y: 0.7 },
      { x: -8, y: 0.7 },
    ],
  })
  expect(shortenNetLabelConnectorsNearTraces(input).movedLabelCount).toBe(0)
})
