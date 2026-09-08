import { expect, test } from "bun:test"
import {
  isAxisAlignedSegment,
  orthogonalizeTracePath,
  orthogonalizeTracePathCandidates,
} from "lib/solvers/NetLabelToTraceSolver/orthogonalizeTracePath"

test("orthogonalizeTracePath inserts an elbow for a near-horizontal diagonal", () => {
  const start = { x: -9.99, y: 10.39 }
  const end = { x: -14.7, y: 10.4 }
  const path = orthogonalizeTracePath([start, end], true)
  expect(path).toEqual([start, { x: end.x, y: start.y }, end])
  for (let index = 0; index < path.length - 1; index++) {
    expect(isAxisAlignedSegment(path[index]!, path[index + 1]!)).toBe(true)
  }
})

test("orthogonalizeTracePathCandidates prefers the longer axis first", () => {
  const start = { x: -9.99, y: 10.39 }
  const end = { x: -14.7, y: 10.4 }
  const [preferred, alternate] = orthogonalizeTracePathCandidates([start, end])
  expect(preferred).toEqual([start, { x: end.x, y: start.y }, end])
  expect(alternate).toEqual([start, { x: start.x, y: end.y }, end])
})
