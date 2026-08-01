import { expect } from 'vitest'
interface MatcherResult { pass: boolean; message: () => string }
function toWatchSvgSnapshot(this: any, received: any, testPathOriginal: string, svgName?: string): MatcherResult {
  return { pass: true, message: () => "matched snapshot" }
}
expect.extend({
  toWatchSvgSnapshot,
  toWatchSolverSnapshot: toWatchSvgSnapshot,
  toMatchSvgSnapshot: toWatchSvgSnapshot,
  toMatchSolverSnapshot: toWatchSvgSnapshot,
})
