import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import type { InputProblem } from "lib/types/InputProblem"
import type {
  MspConnectionPairId,
  MspConnectionPair,
} from "lib/solvers/MspConnectionPairSolver/MspConnectionPairSolver"
import type { SolvedTracePath } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { NetLabelPlacement } from "lib/solvers/NetLabelPlacementSolver/NetLabelPlacementSolver"
import { generateElbowVariants } from "lib/solvers/SchematicTraceLinesSolver/SchematicTraceSingleLineSolver/generateElbowVariants"
import type { Guideline } from "lib/solvers/GuidelinesSolver/GuidelinesSolver"
import type { Point } from "@tscircuit/math-utils"
import { segmentIntersectsRect } from "lib/solvers/NetLabelPlacementSolver/SingleNetLabelPlacementSolver/collisions"

const EPS = 1e-9

export class NetLabelTraceShiftSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
  netLabelPlacements: NetLabelPlacement[]
  correctedTraceMap: Record<MspConnectionPairId, SolvedTracePath>

  constructor(params: {
    inputProblem: InputProblem
    inputTraceMap: Record<MspConnectionPairId, SolvedTracePath>
    netLabelPlacements: NetLabelPlacement[]
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTraceMap = params.inputTraceMap
    this.netLabelPlacements = params.netLabelPlacements
    this.correctedTraceMap = structuredClone(params.inputTraceMap)
  }

  override getConstructorParams(): ConstructorParameters<typeof NetLabelTraceShiftSolver>[0] {
    return {
      inputProblem: this.inputProblem,
      inputTraceMap: this.inputTraceMap,
      netLabelPlacements: this.netLabelPlacements,
    }
  }

  private findCollision(
    rect: { minX: number; minY: number; maxX: number; maxY: number },
    ignorePairIds: Set<MspConnectionPairId>,
  ): { mspPairId: MspConnectionPairId; segIndex: number } | null {
    for (const [pairId, solved] of Object.entries(this.correctedTraceMap)) {
      if (ignorePairIds.has(pairId)) continue
      const pts = solved.tracePath
      for (let i = 0; i < pts.length - 1; i++) {
        if (segmentIntersectsRect(pts[i]!, pts[i + 1]!, rect, EPS)) {
          return { mspPairId: pairId, segIndex: i }
        }
      }
    }
    return null
  }

  private variantIntersectsRect(
    pts: Point[],
    rect: { minX: number; minY: number; maxX: number; maxY: number },
  ): boolean {
    for (let i = 0; i < pts.length - 1; i++) {
      if (segmentIntersectsRect(pts[i]!, pts[i + 1]!, rect, EPS)) return true
    }
    return false
  }

  override _step() {
    for (const label of this.netLabelPlacements) {
      const rect = {
        minX: label.center.x - label.width / 2,
        maxX: label.center.x + label.width / 2,
        minY: label.center.y - label.height / 2,
        maxY: label.center.y + label.height / 2,
      }

      const ignorePairIds = new Set<MspConnectionPairId>(
        label.mspConnectionPairIds,
      )

      let collision = this.findCollision(rect, ignorePairIds)
      let guard = 0
      while (collision && guard++ < 10) {
        const path = this.correctedTraceMap[collision.mspPairId]
        if (!path) break
        const pts = path.tracePath
        const segIndex = collision.segIndex
        if (segIndex <= 0 || segIndex >= pts.length - 2) break

        const baseElbow = pts.slice(segIndex - 1, segIndex + 3)

        const isVert = Math.abs(baseElbow[1]!.x - baseElbow[2]!.x) < EPS
        const guidelines: Guideline[] = []
        const margin = 0.2
        if (isVert) {
          guidelines.push({
            orientation: "vertical",
            x: rect.minX - margin,
            y: undefined,
          })
          guidelines.push({
            orientation: "vertical",
            x: rect.maxX + margin,
            y: undefined,
          })
        } else {
          guidelines.push({
            orientation: "horizontal",
            y: rect.minY - margin,
            x: undefined,
          })
          guidelines.push({
            orientation: "horizontal",
            y: rect.maxY + margin,
            x: undefined,
          })
        }

        const isOrthogonal = baseElbow.every((p, i) => {
          if (i === 0) return true
          const prev = baseElbow[i - 1]!
          return Math.abs(p.x - prev.x) < EPS || Math.abs(p.y - prev.y) < EPS
        })
        if (!isOrthogonal) break

        let elbowVariants: Point[][]
        try {
          elbowVariants = generateElbowVariants({
            baseElbow,
            guidelines,
          }).elbowVariants
        } catch {
          break
        }

        let replaced = false
        for (const variant of elbowVariants.slice(1)) {
          if (this.variantIntersectsRect(variant, rect)) continue
          const newPath = [
            ...pts.slice(0, segIndex - 1),
            ...variant,
            ...pts.slice(segIndex + 3),
          ]
          this.correctedTraceMap[collision.mspPairId] = {
            ...(path as MspConnectionPair),
            tracePath: newPath,
            mspConnectionPairIds: path.mspConnectionPairIds,
            pinIds: path.pinIds,
          } as SolvedTracePath
          replaced = true
          break
        }

        if (!replaced) break
        collision = this.findCollision(rect, ignorePairIds)
      }
    }

    this.solved = true
  }
}
