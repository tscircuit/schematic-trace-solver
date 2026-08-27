import { expect, test } from "bun:test"
import { doesTraceRecoveryPathConflict } from "lib/solvers/NetLabelTraceRecovery/doesTraceRecoveryPathConflict"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"

const trace = (tracePath: Array<{ x: number; y: number }>) =>
  ({ tracePath }) as SolvedTracePath

test("allows a perpendicular crossing inside both trace segments", () => {
  expect(
    doesTraceRecoveryPathConflict(
      [
        { x: 1, y: 0 },
        { x: 1, y: 2 },
      ],
      [
        trace([
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ]),
      ],
    ),
  ).toBe(false)
})

test("rejects a cross-net T-junction", () => {
  expect(
    doesTraceRecoveryPathConflict(
      [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      [
        trace([
          { x: 0, y: 1 },
          { x: 2, y: 1 },
        ]),
      ],
    ),
  ).toBe(true)
})

test("rejects a shared trace segment", () => {
  expect(
    doesTraceRecoveryPathConflict(
      [
        { x: 1, y: 0 },
        { x: 1, y: 2 },
      ],
      [
        trace([
          { x: 1, y: 1 },
          { x: 1, y: 3 },
        ]),
      ],
    ),
  ).toBe(true)
})
