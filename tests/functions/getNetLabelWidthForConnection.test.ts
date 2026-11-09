import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { getNetLabelWidthForConnection } from "../../lib/utils/getNetLabelWidthForConnection.ts"

const makeProblem = (
  directConnections: Array<{
    pinIds: [string, string]
    netLabelWidth?: number
    anchoredNetLabelWidth?: number
  }>,
  netConnections: Array<{
    pinIds: string[]
    netId: string
    netLabelWidth?: number
    anchoredNetLabelWidth?: number
  }> = [],
) => ({
  chips: [],
  availableNetLabelOrientations: {},
  directConnections,
  netConnections,
})

describe("getNetLabelWidthForConnection", () => {
  it("finds an explicit width after a matching direct connection without one", () => {
    const inputProblem = makeProblem([
      { pinIds: ["P1", "P2"] },
      { pinIds: ["P1", "P3"], netLabelWidth: 0.84 },
    ])

    assert.equal(
      getNetLabelWidthForConnection({
        inputProblem,
        pinIds: ["P1"],
        isPortOnlyLabel: false,
      }),
      0.84,
    )
  })

  it("finds an explicit width after a matching net connection without one", () => {
    const inputProblem = makeProblem([], [
      { netId: "N1", pinIds: ["P1", "P2"] },
      { netId: "N2", pinIds: ["P1", "P3"], netLabelWidth: 0.62 },
    ])

    assert.equal(
      getNetLabelWidthForConnection({
        inputProblem,
        pinIds: ["P1"],
        isPortOnlyLabel: false,
      }),
      0.62,
    )
  })

  it("preserves direct-connection priority and a zero explicit width", () => {
    const inputProblem = makeProblem(
      [{ pinIds: ["P1", "P2"], netLabelWidth: 0 }],
      [{ netId: "N1", pinIds: ["P1"], netLabelWidth: 0.75 }],
    )
    assert.equal(
      getNetLabelWidthForConnection({
        inputProblem,
        pinIds: ["P1"],
        isPortOnlyLabel: false,
      }),
      0,
    )
  })

  it("uses anchored width for port-only label when no standard width exists", () => {
    const inputProblem = makeProblem([
      { pinIds: ["P1", "P2"] },
      { pinIds: ["P1", "P3"], anchoredNetLabelWidth: 0.51 },
    ])
    assert.equal(
      getNetLabelWidthForConnection({
        inputProblem,
        pinIds: ["P1"],
        isPortOnlyLabel: true,
      }),
      0.51,
    )
  })
})
