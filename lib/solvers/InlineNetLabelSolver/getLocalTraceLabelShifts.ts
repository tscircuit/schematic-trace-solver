import type { Bounds, Point } from "@tscircuit/math-utils"
import { getSegmentIntersection } from "@tscircuit/math-utils/line-intersections"
import type { InputProblem } from "lib/types/InputProblem"
import { segmentIntersectsRect } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver2/collisions"
import { tracePathContainsPoint } from "lib/solvers/RailNetLabelCornerPlacementSolver/geometry"
import { simplifyPath } from "lib/solvers/TraceCleanupSolver/simplifyPath"
import { minimizeTurnsWithFilteredLabels } from "lib/solvers/TraceCleanupSolver/minimizeTurnsWithFilteredLabels"
import { preservesLabelAnchors } from "lib/solvers/TraceCleanupSolver/sameNetRailAlignment/preservesLabelAnchors"
import { doesPathCoincideWithTraces } from "lib/utils/doesPathCoincideWithTraces"
import { boundsOverlap, getTextBoxBounds } from "lib/utils/textBoxBounds"
import { getAnchoredNetLabelRenderedBounds } from "./getAnchoredNetLabelRenderedBounds"
import {
  getInlineLabelObstacles,
  getInlineTerminalBounds,
} from "./getInlineLabelObstacles"
import { NetLabelNetLabelCollisionSolver } from "../NetLabelNetLabelCollisionSolver/NetLabelNetLabelCollisionSolver"
import type {
  InlineNetLabelOutput,
  InlineNetLabelPlacement,
} from "./InlineNetLabelSolver"

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
 * Propose a sideways shift of an existing leg and its connected rail. Never add corners,
 * route around a component, or search beyond the obstructing label column.
 * A leaf power label may move sideways with its existing short connector.
 * The caller must replan inline labels before committing a proposal.
 */
export function* getLocalTraceLabelShifts(
  inputProblem: InputProblem,
  output: Output,
  pendingInlinePlacements: InlineNetLabelPlacement[] = [],
): Generator<Output> {
  const placements = [
    ...output.inlineNetLabelPlacements,
    ...pendingInlinePlacements,
  ]
  const { fixedLabels, terminalTraces } = getInlineLabelObstacles(
    inputProblem,
    placements,
  )
  const terminalBounds = placements.flatMap((label) => {
    const bounds = getInlineTerminalBounds(label)
    return bounds ? [{ label, bounds }] : []
  })
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
  const pinPositions = [
    ...inputProblem.chips.flatMap((chip) => chip.pins),
    ...output.traces.flatMap((trace) => trace.pins),
  ]
  for (const trace of output.traces) {
    const path = simplifyPath(trace.tracePath)
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i]!,
        b = path[i + 1]!
      const axis = Math.abs(a.x - b.x) < EPS ? "x" : "y"
      const along = axis === "x" ? "y" : "x"
      if (Math.abs(a[axis] - b[axis]) > EPS || same(a, b)) continue
      const blocking = [
        ...output.netLabelPlacements
          .filter((label) => label.globalConnNetId !== trace.globalConnNetId)
          .map(getAnchoredNetLabelRenderedBounds),
        ...inlineBounds,
        ...terminalBounds
          .filter(
            ({ label }) =>
              !trace.pinIds.some((pinId) => label.pinIds.includes(pinId)),
          )
          .map(({ bounds }) => bounds),
      ].filter((bounds) => segmentIntersectsRect(a, b, bounds))
      if (!blocking.length) continue
      // Cleanup can split one rail across several trace records, including a
      // branch that starts at a junction instead of at its pin. Shift the
      // connected collinear rail and its branch ends together.
      let low = Math.min(a[along], b[along])
      let high = Math.max(a[along], b[along])
      let expanded = true
      while (expanded) {
        expanded = false
        for (const other of output.traces) {
          if (other.globalConnNetId !== trace.globalConnNetId) continue
          for (let j = 1; j < other.tracePath.length; j++) {
            const p = other.tracePath[j - 1]!,
              q = other.tracePath[j]!
            if (
              Math.abs(p[axis] - a[axis]) > EPS ||
              Math.abs(q[axis] - a[axis]) > EPS
            )
              continue
            const min = Math.min(p[along], q[along]),
              max = Math.max(p[along], q[along])
            if (max < low - EPS || min > high + EPS) continue
            if (min < low || max > high) expanded = true
            low = Math.min(low, min)
            high = Math.max(high, max)
          }
        }
      }
      const onRail = (p: Point) =>
        Math.abs(p[axis] - a[axis]) < EPS &&
        p[along] >= low - EPS &&
        p[along] <= high + EPS
      if (pinPositions.some(onRail)) continue
      const minKey = axis === "x" ? "minX" : "minY"
      const maxKey = axis === "x" ? "maxX" : "maxY"
      const localWidth = Math.max(
        ...blocking.map((bounds) => bounds[maxKey] - bounds[minKey]),
      )
      const railLabelBounds = output.netLabelPlacements
        .filter(
          (label) =>
            label.globalConnNetId === trace.globalConnNetId &&
            onRail(label.anchorPoint),
        )
        .map(getAnchoredNetLabelRenderedBounds)
      const coordinates = [
        ...new Set(
          blocking.flatMap((bounds) => [
            bounds[minKey] - CLEARANCE,
            bounds[maxKey] + CLEARANCE,
            ...railLabelBounds
              .filter((own) => boundsOverlap(own, bounds))
              .flatMap((own) => [
                a[axis] + bounds[minKey] - CLEARANCE - own[maxKey],
                a[axis] + bounds[maxKey] + CLEARANCE - own[minKey],
              ]),
          ]),
        ),
      ].sort((x, y) => Math.abs(x - a[axis]) - Math.abs(y - a[axis]))
      for (const coordinate of coordinates) {
        const distance = coordinate - a[axis]
        if (Math.abs(distance) > localWidth + 2 * CLEARANCE) continue
        const traces = output.traces.map((other) => {
          if (
            other.globalConnNetId !== trace.globalConnNetId ||
            !other.tracePath.some(onRail)
          )
            return other
          return {
            ...other,
            tracePath: other.tracePath.map((p) =>
              onRail(p) ? translate(p, axis, distance) : p,
            ),
          }
        })
        const shiftedPaths = traces
          .filter((other, index) => other !== output.traces[index])
          .map((other) => other.tracePath)
        let labels = output.netLabelPlacements.map((label) => {
          if (
            label.globalConnNetId !== trace.globalConnNetId ||
            !onRail(label.anchorPoint)
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
          if (
            shiftedPaths.some((p) => hits(p, bounds)) &&
            !output.traces.some(
              (other) =>
                other.globalConnNetId === trace.globalConnNetId &&
                hits(other.tracePath, bounds),
            )
          )
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
        // A shifted leg can coincide with a redundant bend on another net.
        // Try removing that bend with the existing cleanup, then validate
        // both changed routes together below before yielding the proposal.
        for (const [index, other] of traces.entries()) {
          if (
            other.globalConnNetId === trace.globalConnNetId ||
            simplifyPath(other.tracePath).length <= 4 ||
            !shiftedPaths.some((path) =>
              doesPathCoincideWithTraces(path, [other]),
            )
          )
            continue
          const simplified = minimizeTurnsWithFilteredLabels({
            inputProblem,
            traces: [...traces, ...terminalTraces],
            targetMspConnectionPairId: other.mspPairId,
            allLabelPlacements: [...labels, ...fixedLabels],
            mergedLabelNetIdMap: {},
            paddingBuffer: CLEARANCE,
          })
          if (
            simplifyPath(simplified.tracePath).length <
              simplifyPath(other.tracePath).length &&
            preservesLabelAnchors(labels, [other], [simplified])
          )
            traces[index] = simplified
        }
        for (const [index, proposed] of traces.entries()) {
          const original = output.traces[index]!
          if (proposed === original) continue
          const candidate = proposed.tracePath
          const previous = original.tracePath
          if (
            candidate
              .slice(1)
              .some(
                (p, index) =>
                  Math.abs(p.x - candidate[index]!.x) > EPS &&
                  Math.abs(p.y - candidate[index]!.y) > EPS,
              )
          ) {
            blocked = true
            break
          }
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
          const junctions = output.traces
            .filter(
              (other) =>
                other !== original &&
                other.globalConnNetId === original.globalConnNetId,
            )
            .flatMap((other) => [
              ...other.tracePath,
              ...intersections(previous, other.tracePath),
            ])
            .filter((p) => tracePathContainsPoint(previous, p))
            .map((p) =>
              original.globalConnNetId === trace.globalConnNetId && onRail(p)
                ? translate(p, axis, distance)
                : p,
            )
          const protectedPoints = [
            ...pinPositions.filter((p) => tracePathContainsPoint(previous, p)),
            ...junctions,
          ]
          if (
            protectedPoints.some(
              (p) => !tracePathContainsPoint(candidate, p),
            ) ||
            pinPositions.some((p) => {
              const clearance = {
                minX: p.x - CLEARANCE,
                maxX: p.x + CLEARANCE,
                minY: p.y - CLEARANCE,
                maxY: p.y + CLEARANCE,
              }
              return hits(candidate, clearance) && !hits(previous, clearance)
            }) ||
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
