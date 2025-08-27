import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem, PinId } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { MspConnectionPairId } from "../MspConnectionPairSolver/MspConnectionPairSolver"
import { SingleNetLabelPlacementSolver } from "./SingleNetLabelPlacementSolver/SingleNetLabelPlacementSolver"
import type { FacingDirection } from "lib/utils/dir"
import type { Point } from "@tscircuit/math-utils"
import type { GraphicsObject } from "graphics-debug"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import { getColorFromString } from "lib/utils/getColorFromString"
import { getConnectivityMapsFromInputProblem } from "../MspConnectionPairSolver/getConnectivityMapFromInputProblem"

/**
 * A group of traces that have at least one overlapping segment and
 * are part of the same global connectivity net
 */
export type OverlappingSameNetTraceGroup = {
  globalConnNetId: string
  netId?: string
  overlappingTraces?: SolvedTracePath
  portOnlyPinId?: string
}

export interface NetLabelPlacement {
  globalConnNetId: string
  dcConnNetId?: string
  /**
   * Optional user-provided net identifier (if present in the input problem).
   */
  netId?: string
  /**
   * MSP pair ids that the label is associated with. Port-only labels use [].
   */
  mspConnectionPairIds: MspConnectionPairId[]
  /**
   * Pin ids relevant to this label. For a host trace, the two pins of that pair;
   * for a port-only label, the single port pin id.
   */
  pinIds: PinId[]
  orientation: FacingDirection

  /**
   * The anchor point is the point on the trace where the net label connects
   */
  anchorPoint: Point

  width: number
  height: number

  /**
   * The center point is computed from the anchor point, the width and height
   * and the orientation.
   */
  center: Point
}

/**
 * Places net labels in an available orientation along a trace in each group.
 *
 * Trace groups each receive either one net label or no net label if there
 * isn't a netId.
 *
 * The specific placement of the net label is solved for using the
 */
export class NetLabelPlacementSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  overlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  queuedOverlappingSameNetTraceGroups: Array<OverlappingSameNetTraceGroup>

  declare activeSubSolver: SingleNetLabelPlacementSolver | null

  netLabelPlacements: Array<NetLabelPlacement> = []
  currentGroup: OverlappingSameNetTraceGroup | null = null
  triedAnyOrientationFallbackForCurrentGroup = false

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap

    this.overlappingSameNetTraceGroups =
      this.computeOverlappingSameNetTraceGroups()

    this.queuedOverlappingSameNetTraceGroups = [
      ...this.overlappingSameNetTraceGroups,
    ]
  }

  computeOverlappingSameNetTraceGroups(): Array<OverlappingSameNetTraceGroup> {
    // Group existing traces by their global connectivity net id.
    const byGlobal: Record<string, Array<SolvedTracePath>> = {}
    for (const trace of Object.values(this.inputTraceMap)) {
      const key = trace.globalConnNetId
      if (!byGlobal[key]) byGlobal[key] = []
      byGlobal[key].push(trace)
    }

    // Build global connectivity from input so we also consider pins with no traces
    const { netConnMap } = getConnectivityMapsFromInputProblem(
      this.inputProblem,
    )

    // Map pins to user-provided netIds (if any)
    const userNetIdByPinId: Record<string, string | undefined> = {}
    for (const dc of this.inputProblem.directConnections) {
      if (dc.netId) {
        const [a, b] = dc.pinIds
        userNetIdByPinId[a] = dc.netId
        userNetIdByPinId[b] = dc.netId
      }
    }
    for (const nc of this.inputProblem.netConnections) {
      for (const pid of nc.pinIds) {
        userNetIdByPinId[pid] = nc.netId
      }
    }

    const groups: Array<OverlappingSameNetTraceGroup> = []

    // Consider every global connectivity net id
    for (const globalConnNetId of Object.keys((netConnMap as any).netMap)) {
      const pinsInNet = netConnMap.getIdsConnectedToNet(
        globalConnNetId,
      ) as string[]

      // Build adjacency from solved traces (edges)
      const adj: Record<string, Set<string>> = {}
      for (const pid of pinsInNet) adj[pid] = new Set()
      for (const t of byGlobal[globalConnNetId] ?? []) {
        const a = t.pins[0].pinId
        const b = t.pins[1].pinId
        if (adj[a] && adj[b]) {
          adj[a].add(b)
          adj[b].add(a)
        }
      }

      // Find connected components based on trace edges
      const visited = new Set<string>()
      for (const pid of pinsInNet) {
        if (visited.has(pid)) continue
        const stack = [pid]
        const component = new Set<string>()
        visited.add(pid)
        while (stack.length > 0) {
          const u = stack.pop()!
          component.add(u)
          for (const v of adj[u] ?? []) {
            if (!visited.has(v)) {
              visited.add(v)
              stack.push(v)
            }
          }
        }

        // Collect traces fully inside this component
        const compTraces = (byGlobal[globalConnNetId] ?? []).filter(
          (t) =>
            component.has(t.pins[0].pinId) && component.has(t.pins[1].pinId),
        )

        if (compTraces.length > 0) {
          // Choose a representative trace (longest by L1 length)
          const lengthOf = (path: SolvedTracePath) => {
            let sum = 0
            const pts = path.tracePath
            for (let i = 0; i < pts.length - 1; i++) {
              sum +=
                Math.abs(pts[i + 1]!.x - pts[i]!.x) +
                Math.abs(pts[i + 1]!.y - pts[i]!.y)
            }
            return sum
          }
          let rep = compTraces[0]!
          let repLen = lengthOf(rep)
          for (let i = 1; i < compTraces.length; i++) {
            const len = lengthOf(compTraces[i]!)
            if (len > repLen) {
              rep = compTraces[i]!
              repLen = len
            }
          }

          let userNetId = compTraces.find((t) => t.userNetId != null)?.userNetId
          if (!userNetId) {
            for (const p of component) {
              if (userNetIdByPinId[p]) {
                userNetId = userNetIdByPinId[p]
                break
              }
            }
          }

          groups.push({
            globalConnNetId,
            netId: userNetId,
            overlappingTraces: rep,
          })
        } else {
          // No traces in this component: place label at each pin that has a user net id
          for (const p of component) {
            const userNetId = userNetIdByPinId[p]
            if (!userNetId) continue
            groups.push({
              globalConnNetId,
              netId: userNetId,
              portOnlyPinId: p,
            })
          }
        }
      }
    }

    return groups
  }

  override _step() {
    if (this.activeSubSolver?.solved) {
      this.netLabelPlacements.push(this.activeSubSolver.netLabelPlacement!)
      this.activeSubSolver = null
      this.currentGroup = null
      this.triedAnyOrientationFallbackForCurrentGroup = false
      return
    }

    if (this.activeSubSolver?.failed) {
      // Retry once with all orientations as a fallback before failing
      const fullOrients: FacingDirection[] = ["x+", "x-", "y+", "y-"]
      const currOrients = this.activeSubSolver.availableOrientations
      const isAlreadyFull =
        currOrients.length === 4 &&
        fullOrients.every((o) => currOrients.includes(o))

      if (
        !this.triedAnyOrientationFallbackForCurrentGroup &&
        !isAlreadyFull &&
        this.currentGroup
      ) {
        this.triedAnyOrientationFallbackForCurrentGroup = true
        this.activeSubSolver = new SingleNetLabelPlacementSolver({
          inputProblem: this.inputProblem,
          inputTraceMap: this.inputTraceMap,
          overlappingSameNetTraceGroup: this.currentGroup,
          availableOrientations: fullOrients,
        })
        return
      }

      this.failed = true
      this.error = this.activeSubSolver.error
      return
    }

    if (this.activeSubSolver) {
      this.activeSubSolver.step()
      return
    }

    const nextOverlappingSameNetTraceGroup =
      this.queuedOverlappingSameNetTraceGroups.shift()

    if (!nextOverlappingSameNetTraceGroup) {
      this.solved = true
      return
    }

    const netId =
      nextOverlappingSameNetTraceGroup.netId ??
      nextOverlappingSameNetTraceGroup.globalConnNetId

    this.currentGroup = nextOverlappingSameNetTraceGroup
    this.triedAnyOrientationFallbackForCurrentGroup = false

    this.activeSubSolver = new SingleNetLabelPlacementSolver({
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      overlappingSameNetTraceGroup: nextOverlappingSameNetTraceGroup,
      availableOrientations: this.inputProblem.availableNetLabelOrientations[
        netId
      ] ?? ["x+", "x-", "y+", "y-"],
    })
  }

  override visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }
    const graphics = visualizeInputProblem(this.inputProblem)

    for (const trace of Object.values(this.inputTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "purple",
        strokeWidth: 0.005,
      })
    }

    for (const p of this.netLabelPlacements) {
      graphics.rects!.push({
        center: p.center,
        width: p.width,
        height: p.height,
        fill: getColorFromString(p.globalConnNetId, 0.35),
        strokeColor: getColorFromString(p.globalConnNetId, 0.9),
      } as any)
      graphics.points!.push({
        x: p.anchorPoint.x,
        y: p.anchorPoint.y,
        color: getColorFromString(p.globalConnNetId, 0.9),
      } as any)
    }

    return graphics
  }
}
