import { expect, test } from "bun:test"
import type { Point } from "@tscircuit/math-utils"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import { mergeSameNetCloseTraceLines } from "lib/solvers/TraceCleanupSolver/mergeSameNetCloseTraceLines"

const trace = (
  mspPairId: string,
  globalConnNetId: string,
  tracePath: Point[],
): SolvedTracePath =>
  ({
    mspPairId,
    dcConnNetId: globalConnNetId,
    globalConnNetId,
    pins: [] as any,
    tracePath,
    mspConnectionPairIds: [mspPairId],
    pinIds: [`${mspPairId}.1`, `${mspPairId}.2`],
  }) as SolvedTracePath

test("mergeSameNetCloseTraceLines snaps close horizontal same-net segments to the same y", () => {
  const [baseTrace, branchTrace] = mergeSameNetCloseTraceLines([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 1, y: -1 },
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
      { x: 3, y: -1 },
    ]),
  ])

  expect(baseTrace!.tracePath).toEqual([
    { x: 0, y: 0 },
    { x: 4, y: 0 },
  ])
  expect(branchTrace!.tracePath).toEqual([
    { x: 1, y: -1 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: -1 },
  ])
})

test("mergeSameNetCloseTraceLines snaps close vertical same-net segments to the same x", () => {
  const [, branchTrace] = mergeSameNetCloseTraceLines([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 0, y: 4 },
    ]),
    trace("b", "net1", [
      { x: -1, y: 1 },
      { x: 0.2, y: 1 },
      { x: 0.2, y: 3 },
      { x: -1, y: 3 },
    ]),
  ])

  expect(branchTrace!.tracePath).toEqual([
    { x: -1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 3 },
    { x: -1, y: 3 },
  ])
})

test("mergeSameNetCloseTraceLines preserves terminal pin endpoints", () => {
  const [, terminalTrace] = mergeSameNetCloseTraceLines([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net1", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
  ])

  expect(terminalTrace!.tracePath).toEqual([
    { x: 1, y: 0.2 },
    { x: 1, y: 0 },
    { x: 3, y: 0 },
    { x: 3, y: 0.2 },
  ])
})

test("mergeSameNetCloseTraceLines does not snap different-net or far same-net segments", () => {
  const [, differentNetTrace, farTrace] = mergeSameNetCloseTraceLines([
    trace("a", "net1", [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]),
    trace("b", "net2", [
      { x: 1, y: 0.2 },
      { x: 3, y: 0.2 },
    ]),
    trace("c", "net1", [
      { x: 1, y: 0.31 },
      { x: 3, y: 0.31 },
    ]),
  ])

  expect(differentNetTrace!.tracePath).toEqual([
    { x: 1, y: 0.2 },
    { x: 3, y: 0.2 },
  ])
  expect(farTrace!.tracePath).toEqual([
    { x: 1, y: 0.31 },
    { x: 3, y: 0.31 },
  ])
})
