import { describe, expect, test } from "bun:test"
import { getNetLabelWidthForConnection } from "lib/utils/getNetLabelWidthForConnection"
import type { InputProblem } from "lib/types/InputProblem"

const baseProblem = (): InputProblem =>
  ({
    directConnections: [],
    netConnections: [],
  }) as unknown as InputProblem

describe("getNetLabelWidthForConnection", () => {
  test("later direct connection with width is honored", () => {
    const problem = baseProblem()
    problem.directConnections = [
      { netId: "net1", pinIds: ["pin1"] },
      { netId: "net1", pinIds: ["pin1"], netLabelWidth: 2.5 },
    ] as any
    expect(
      getNetLabelWidthForConnection({
        inputProblem: problem,
        pinIds: ["pin1"],
        isPortOnlyLabel: false,
      }),
    ).toBe(2.5)
  })

  test("later net connection with width is honored", () => {
    const problem = baseProblem()
    problem.netConnections = [
      { netId: "net1", pinIds: ["pin1"] },
      { netId: "net1", pinIds: ["pin1"], netLabelWidth: 3 },
    ] as any
    expect(
      getNetLabelWidthForConnection({
        inputProblem: problem,
        pinIds: ["pin1"],
        isPortOnlyLabel: false,
      }),
    ).toBe(3)
  })

  test("direct connection takes precedence when it has explicit zero width", () => {
    const problem = baseProblem()
    problem.directConnections = [
      { netId: "net1", pinIds: ["pin1"], netLabelWidth: 0 },
    ] as any
    problem.netConnections = [
      { netId: "net1", pinIds: ["pin1"], netLabelWidth: 5 },
    ] as any
    expect(
      getNetLabelWidthForConnection({
        inputProblem: problem,
        pinIds: ["pin1"],
        isPortOnlyLabel: false,
      }),
    ).toBe(0)
  })

  test("port-only label falls back to anchored width in a later connection", () => {
    const problem = baseProblem()
    problem.netConnections = [
      { netId: "net1", pinIds: ["pin1"] },
      { netId: "net1", pinIds: ["pin1"], anchoredNetLabelWidth: 4.2 },
    ] as any
    expect(
      getNetLabelWidthForConnection({
        inputProblem: problem,
        pinIds: ["pin1"],
        isPortOnlyLabel: true,
      }),
    ).toBe(4.2)
  })
})
