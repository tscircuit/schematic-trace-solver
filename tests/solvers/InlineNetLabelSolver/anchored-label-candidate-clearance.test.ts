import { expect, test } from "bun:test"
import { pushAnchoredNetLabelsAwayFromInlineLabels } from "lib/solvers/InlineNetLabelSolver/pushAnchoredNetLabelsAwayFromInlineLabels"
import { isLabelAndConnectorClearOfTraces } from "lib/solvers/NetLabelPlacementSolver/isLabelAndConnectorClearOfTraces"
import { getShaftPositionLabelClearanceInput } from "tests/repros/assets/repro-rp2040-shaft-position-label-clearance.input"

const getCandidateInput = () => {
  const input = getShaftPositionLabelClearanceInput()
  // Start at the resistor pin, before a clearance connector is created. Inline
  // text conflicts with the lower end of the initial vertical tag. An outward
  // push would put the tag through the foreign SDA wire; a horizontal tag fits.
  input.traces.pop()
  input.netLabelConnectorTraceIds.clear()
  input.netLabelPlacements[0]!.anchorPoint = { x: -9, y: 1.9 }
  input.netLabelPlacements[0]!.center = { x: -9, y: 1.81 }
  return {
    ...input,
    inlineNetLabelPlacements: [
      {
        globalConnNetId: "ENC_SDA",
        netId: "ENC_SDA",
        pinIds: ["R_ENC_SDA.1", "U_ENCODER.6"],
        axis: "x" as const,
        side: "y+" as const,
        anchorPoint: { x: -9, y: 0.93 },
        center: { x: -9, y: 1.02 },
        width: 0.8,
        height: 0.18,
      },
    ],
  }
}

test("chooses a valid label and connector before committing an outward push", () => {
  const input = getCandidateInput()
  const original = structuredClone(input)
  const output = pushAnchoredNetLabelsAwayFromInlineLabels(input)
  const label = output.netLabelPlacements[0]!
  const connector = output.traces.find((trace) =>
    output.netLabelConnectorTraceIds.has(trace.mspPairId),
  )!
  expect(output.movedLabelCount).toBe(1)
  expect(["x-", "x+"]).toContain(label.orientation)
  expect(label.anchorPoint.y).toBeCloseTo(1.8)
  expect(connector.tracePath).toEqual([
    input.netLabelPlacements[0]!.anchorPoint,
    label.anchorPoint,
  ])
  expect(
    isLabelAndConnectorClearOfTraces({
      label,
      connectorPath: connector.tracePath,
      traces: input.traces,
    }),
  ).toBe(true)
  expect(output.traces[0]).toEqual(input.traces[0])
  expect(input).toEqual(original)
})

test("rejects the entire proposal if every allowed candidate is blocked", () => {
  const input = getCandidateInput()
  input.inputProblem.textBoxes!.push({
    center: { x: -9, y: -0.5 },
    width: 12,
    height: 6,
  })
  const output = pushAnchoredNetLabelsAwayFromInlineLabels(input)
  expect(output.movedLabelCount).toBe(0)
  expect(output.traces).toEqual(input.traces)
  expect(output.netLabelPlacements).toEqual(input.netLabelPlacements)
  expect(output.netLabelConnectorTraceIds.size).toBe(0)
})

for (const gap of [0, 0.001, -0.2]) {
  test(`candidate validation rejects foreign-wire contact at gap ${gap}`, () => {
    const input = getShaftPositionLabelClearanceInput()
    const label = input.netLabelPlacements[0]!
    label.anchorPoint.y = input.traces[0]!.tracePath[1]!.y + gap
    label.center.y = label.anchorPoint.y - 0.09
    expect(
      isLabelAndConnectorClearOfTraces({
        label,
        connectorPath: [{ x: -9, y: 1.9 }, label.anchorPoint],
        traces: [input.traces[0]!],
      }),
    ).toBe(false)
  })
}

test("same-net attachment remains legal", () => {
  const input = getShaftPositionLabelClearanceInput()
  input.traces[0]!.globalConnNetId = "ENC_SCL"
  expect(
    isLabelAndConnectorClearOfTraces({
      label: input.netLabelPlacements[0]!,
      connectorPath: input.traces[1]!.tracePath,
      traces: [input.traces[0]!],
    }),
  ).toBe(true)
})

test("alternate placement respects an explicit orientation constraint", () => {
  const input = getCandidateInput()
  input.inputProblem.availableNetLabelOrientations.ENC_SCL = ["x+"]
  const output = pushAnchoredNetLabelsAwayFromInlineLabels(input)
  expect(output.movedLabelCount).toBe(1)
  expect(output.netLabelPlacements[0]!.orientation).toBe("x+")
})

test("rejects parallel connector overlap with another net", () => {
  const input = getShaftPositionLabelClearanceInput()
  input.traces[0]!.tracePath = [
    { x: -9.001, y: 0.6 },
    { x: -9.001, y: 1.8 },
  ]
  expect(
    isLabelAndConnectorClearOfTraces({
      label: input.netLabelPlacements[0]!,
      connectorPath: input.traces[1]!.tracePath,
      traces: [input.traces[0]!],
    }),
  ).toBe(false)
})

test("horizontal and reversed connectors obey the same clearance rule", () => {
  const input = getShaftPositionLabelClearanceInput()
  const rotate = (point: { x: number; y: number }) => ({
    x: -point.y,
    y: point.x,
  })
  const label = input.netLabelPlacements[0]!
  label.anchorPoint = rotate(label.anchorPoint)
  label.orientation = "x+"
  label.center = {
    x: label.anchorPoint.x + label.width / 2,
    y: label.anchorPoint.y,
  }
  input.traces[0]!.tracePath = input.traces[0]!.tracePath.map(rotate)
  const connectorPath = input.traces[1]!.tracePath.map(rotate).reverse()
  expect(
    isLabelAndConnectorClearOfTraces({
      label,
      connectorPath,
      traces: [input.traces[0]!],
    }),
  ).toBe(false)
})
