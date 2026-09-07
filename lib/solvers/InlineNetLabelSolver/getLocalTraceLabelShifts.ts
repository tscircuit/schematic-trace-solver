import type { Bounds, Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { InputProblem } from "lib/types/InputProblem"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import { getInlineLabelObstacles } from "./getInlineLabelObstacles"
import { NetLabelNetLabelCollisionSolver } from "../NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type { InlineNetLabelOutput } from "./InlineNetLabelSolver"

type Output = Omit<InlineNetLabelOutput, "inputProblem">
const EPS = 1e-6
const CLEARANCE = 0.05
const hits = (path: Point[], bounds: Bounds) =>
  path.slice(1).some((p, i) => segmentIntersectsRect(path[i]!, p, bounds))
const same = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) < EPS
const translate = (p: Point, axis: "x" | "y", distance: number) => ({
  ...p,
  [axis]: p[axis] + distance,
})
const intersections = (a: Point[], b: Point[]) =>
  a.slice(1).flatMap((p, i) =>
    b.slice(1).flatMap((q, j) => {
      const point = getSegmentIntersection(a[i]!, p, b[j]!, q)
      return point ? [point] : []
    }),
  )

/**
 * Propose a sideways shift of an existing interior leg. Never add corners,
 * route around a component, or search beyond the obstructing label column.
 * A leaf power label may move sideways with its existing short connector.
 * The caller must replan inline labels before committing a proposal.
 */
export function* getLocalTraceLabelShifts(
  inputProblem: InputProblem,
  output: Output,
): Generator<Output> {
  const { fixedLabels, terminalTraces } = getInlineLabelObstacles(
    inputProblem,
    output.inlineNetLabelPlacements,
  )
  const obstacles = [
    ...inputProblem.chips.map((chip) => ({
      minX: chip.center.x - chip.width / 2,
      maxX: chip.center.x + chip.width / 2,
      minY: chip.center.y - chip.height / 2,
      maxY: chip.center.y + chip.height / 2,
    })),
    ...(inputProblem.textBoxes ?? []).map((box) => getTextBoxBounds(box)),
  ]
  const inlineBounds = fixedLabels.map((label) => ({
    minX: label.center.x - label.width / 2,
    maxX: label.center.x + label.width / 2,
    minY: label.center.y - label.height / 2,
    maxY: label.center.y + label.height / 2,
  }))
  for (const [traceIndex, trace] of output.traces.entries()) {
    const path = simplifyPath(trace.tracePath)
    for (let i = 1; i < path.length - 2; i++) {
      const a = path[i]!,
        b = path[i + 1]!
      const axis = Math.abs(a.x - b.x) < EPS ? "x" : "y"
      const along = axis === "x" ? "y" : "x"
      if (
        Math.abs(a[axis] - b[axis]) > EPS ||
        Math.abs(path[i - 1]![along] - a[along]) > EPS ||
        Math.abs(path[i + 2]![along] - b[along]) > EPS
      )
        continue
      const blocking = [
        ...output.netLabelPlacements
          .filter((label) => label.globalConnNetId !== trace.globalConnNetId)
          .map(getAnchoredNetLabelRenderedBounds),
        ...inlineBounds.filter(
          (_, index) =>
            fixedLabels[index]!.globalConnNetId !== trace.globalConnNetId,
        ),
      ].filter((bounds) => segmentIntersectsRect(a, b, bounds))
      if (!blocking.length) continue
      const minKey = axis === "x" ? "minX" : "minY"
      const maxKey = axis === "x" ? "maxX" : "maxY"
      const localWidth = Math.max(
        ...blocking.map((bounds) => bounds[maxKey] - bounds[minKey]),
      )
      const coordinates = [
        ...new Set(
          blocking.flatMap((bounds) => [
            bounds[minKey] - CLEARANCE,
            bounds[maxKey] + CLEARANCE,
          ]),
        ),
      ].sort((x, y) => Math.abs(x - a[axis]) - Math.abs(y - a[axis]))
      for (const coordinate of coordinates) {
        const distance = coordinate - a[axis]
        if (Math.abs(distance) > localWidth + 2 * CLEARANCE) continue
        const shiftedPath = path.map((p, index) =>
          index === i || index === i + 1 ? translate(p, axis, distance) : p,
        )
        const traces = [...output.traces]
        traces[traceIndex] = { ...trace, tracePath: shiftedPath }
        let labels = output.netLabelPlacements.map((label) => {
          if (
            label.globalConnNetId !== trace.globalConnNetId ||
            !tracePathContainsPoint([a, b], label.anchorPoint)
          )
            return label
          return {
            ...label,
            anchorPoint: translate(label.anchorPoint, axis, distance),
            center: translate(label.center, axis, distance),
          }
        })
        let blocked = false
        const movedOwnLabelBounds = labels.flatMap((label, index) =>
          label !== output.netLabelPlacements[index]
            ? [getAnchoredNetLabelRenderedBounds(label)]
            : [],
        )
        // A movable leaf label can make room for the shifted leg. Its last
        // segment must already run parallel to that leg: extend the existing
        // approach and translate the stem, retaining its orientation and bends.
        for (const [labelIndex, label] of labels.entries()) {
          if (label.globalConnNetId === trace.globalConnNetId) continue
          const bounds = getAnchoredNetLabelRenderedBounds(label)
          const clearanceEdges = movedOwnLabelBounds
            .filter((own) => boundsOverlap(own, bounds))
            .map((own) => own[distance > 0 ? maxKey : minKey])
          if (hits(shiftedPath, bounds) && !hits(path, bounds))
            clearanceEdges.push(coordinate)
          if (!clearanceEdges.length) continue
          const connectorIndex = traces.findIndex(
            (candidate) =>
              candidate.globalConnNetId === label.globalConnNetId &&
              candidate.pinIds.length === 1 &&
              candidate.tracePath.length === 3 &&
              same(candidate.tracePath.at(-1)!, label.anchorPoint),
          )
          const connector = traces[connectorIndex]
          if (!connector) {
            const placementSolver = new NetLabelNetLabelCollisionSolver({
              inputProblem,
              traces: [...traces, ...terminalTraces],
              netLabelPlacements: labels,
              fixedNetLabelPlacements: fixedLabels,
              useRenderedLabelBounds: true,
            })
            const nearby = placementSolver.getNearbyValidPlacements(
              label,
              localWidth + Math.max(label.width, label.height),
            )[0]
            if (!nearby) {
              blocked = true
              break
            }
            labels[labelIndex] = nearby
            continue
          }
          const [start, bend, end] = connector.tracePath as [
            Point,
            Point,
            Point,
          ]
          if (
            Math.abs(bend[axis] - end[axis]) > EPS ||
            Math.abs(start[along] - bend[along]) > EPS
          ) {
            blocked = true
            break
          }
          const delta =
            distance > 0
              ? Math.max(...clearanceEdges) + CLEARANCE - bounds[minKey]
              : Math.min(...clearanceEdges) - CLEARANCE - bounds[maxKey]
          if (
            Math.abs(delta) >
            localWidth + bounds[maxKey] - bounds[minKey] + 2 * CLEARANCE
          ) {
            blocked = true
            break
          }
          const moved = {
            ...label,
            anchorPoint: translate(label.anchorPoint, axis, delta),
            center: translate(label.center, axis, delta),
          }
          labels[labelIndex] = moved
          traces[connectorIndex] = {
            ...connector,
            tracePath: [start, translate(bend, axis, delta), moved.anchorPoint],
          }
        }
        if (blocked) continue
        for (const [index, proposed] of traces.entries()) {
          const original = output.traces[index]!
          if (proposed === original) continue
          const candidate = proposed.tracePath
          const previous = original.tracePath
          // Keep existing pin exits and all shared junctions. In particular,
          // moving a rail must not disconnect a pin midway along it.
          const dot = (a: Point, b: Point, c: Point, d: Point) =>
            (b.x - a.x) * (d.x - c.x) + (b.y - a.y) * (d.y - c.y)
          if (
            dot(previous[0]!, previous[1]!, candidate[0]!, candidate[1]!) <=
              EPS ||
            dot(
              previous.at(-1)!,
              previous.at(-2)!,
              candidate.at(-1)!,
              candidate.at(-2)!,
            ) <= EPS
          ) {
            blocked = true
            break
          }
          const protectedPoints = [
            ...inputProblem.chips.flatMap((chip) => chip.pins),
            ...output.traces
              .filter(
                (other) =>
                  other !== original &&
                  other.globalConnNetId === original.globalConnNetId,
              )
              .flatMap((other) => [
                ...other.tracePath,
                ...intersections(previous, other.tracePath),
              ]),
          ].filter((p) => tracePathContainsPoint(previous, p))
          if (
            protectedPoints.some(
              (p) => !tracePathContainsPoint(candidate, p),
            ) ||
            obstacles.some(
              (bounds) => hits(candidate, bounds) && !hits(previous, bounds),
            )
          ) {
            blocked = true
            break
          }
          for (const other of [...traces, ...terminalTraces]) {
            if (
              other.mspPairId === proposed.mspPairId ||
              other.globalConnNetId === proposed.globalConnNetId
            )
              continue
            const originalOther =
              output.traces.find((t) => t.mspPairId === other.mspPairId) ??
              other
            if (
              doesPathCoincideWithTraces(candidate, [other]) ||
              intersections(candidate, other.tracePath).length >
                intersections(previous, originalOther.tracePath).length
            ) {
              blocked = true
              break
            }
          }
          if (blocked) break
        }
        if (blocked) continue
        for (const [index, label] of labels.entries()) {
          if (label === output.netLabelPlacements[index]) continue
          const bounds = getAnchoredNetLabelRenderedBounds(label)
          if (
            obstacles.some((obstacle) => boundsOverlap(bounds, obstacle)) ||
            inlineBounds.some((other) => boundsOverlap(bounds, other))
          ) {
            blocked = true
            break
          }
          if (
            labels.some(
              (other, j) =>
                index !== j &&
                boundsOverlap(bounds, getAnchoredNetLabelRenderedBounds(other)),
            )
          ) {
            blocked = true
            break
          }
          if (
            [...traces, ...terminalTraces].some(
              (other) =>
                other.globalConnNetId !== label.globalConnNetId &&
                hits(other.tracePath, bounds),
            )
          ) {
            blocked = true
            break
          }
        }
        if (!blocked) yield { ...output, traces, netLabelPlacements: labels }
      }
    }
  }
}
