import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"

export class MergeSameNetTracesSolver extends BaseSolver {
  inputProblem: InputProblem
  inputTracePaths: Array<SolvedTracePath>

  correctedTraceMap: Record<string, SolvedTracePath> = {}

  // The threshold within which parallel same-net traces should be merged
  MERGE_THRESHOLD = 0.8
  EPS = 2e-3

  constructor(params: {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
  }) {
    super()
    this.inputProblem = params.inputProblem
    this.inputTracePaths = params.inputTracePaths

    for (const tracePath of this.inputTracePaths) {
      // Deep clone the trace path points so we can mutate them safely
      this.correctedTraceMap[tracePath.mspPairId] = {
        ...tracePath,
        tracePath: tracePath.tracePath.map((p) => ({ ...p })),
      }
    }
  }

  override getConstructorParams(): ConstructorParameters<
    typeof MergeSameNetTracesSolver
  >[0] {
    return {
      inputProblem: this.inputProblem,
      inputTracePaths: this.inputTracePaths,
    }
  }

  override _step() {
    // We try to find a pair of trace segments to merge.
    // If we find one, we merge it and return. This will naturally re-run until no more merges are possible.

    // Group traces by net
    const netGroups: Record<string, SolvedTracePath[]> = {}
    for (const trace of Object.values(this.correctedTraceMap)) {
      const netId = trace.globalConnNetId
      if (!netGroups[netId]) netGroups[netId] = []
      netGroups[netId].push(trace)
    }

    let mergedAnything = false

    for (const netId in netGroups) {
      const traces = netGroups[netId]!

      for (let t1 = 0; t1 < traces.length; t1++) {
        for (let t2 = t1; t2 < traces.length; t2++) {
          const path1 = traces[t1]!
          const path2 = traces[t2]!

          const pts1 = path1.tracePath
          const pts2 = path2.tracePath

          for (let i = 1; i < pts1.length - 2; i++) {
            for (let j = 1; j < pts2.length - 2; j++) {
              // Skip same segment
              if (t1 === t2 && i === j) continue

              const p1 = pts1[i]!
              const p2 = pts1[i + 1]!

              const q1 = pts2[j]!
              const q2 = pts2[j + 1]!

              const isPVert = Math.abs(p1.x - p2.x) < this.EPS
              const isQVert = Math.abs(q1.x - q2.x) < this.EPS
              const isPHorz = Math.abs(p1.y - p2.y) < this.EPS
              const isQHorz = Math.abs(q1.y - q2.y) < this.EPS

              if (isPVert && isQVert) {
                const dist = Math.abs(p1.x - q1.x)
                if (dist > this.EPS && dist <= this.MERGE_THRESHOLD) {
                  // Check Y overlap
                  const pMinY = Math.min(p1.y, p2.y)
                  const pMaxY = Math.max(p1.y, p2.y)
                  const qMinY = Math.min(q1.y, q2.y)
                  const qMaxY = Math.max(q1.y, q2.y)

                  const overlap =
                    Math.min(pMaxY, qMaxY) - Math.max(pMinY, qMinY)
                  if (overlap > this.EPS) {
                    // Snap P's X to Q's X
                    p1.x = q1.x
                    p2.x = q1.x
                    mergedAnything = true
                    break
                  }
                }
              } else if (isPHorz && isQHorz) {
                const dist = Math.abs(p1.y - q1.y)
                if (dist > this.EPS && dist <= this.MERGE_THRESHOLD) {
                  // Check X overlap
                  const pMinX = Math.min(p1.x, p2.x)
                  const pMaxX = Math.max(p1.x, p2.x)
                  const qMinX = Math.min(q1.x, q2.x)
                  const qMaxX = Math.max(q1.x, q2.x)

                  const overlap =
                    Math.min(pMaxX, qMaxX) - Math.max(pMinX, qMinX)
                  if (overlap > this.EPS) {
                    // Snap P's Y to Q's Y
                    p1.y = q1.y
                    p2.y = q1.y
                    mergedAnything = true
                    break
                  }
                }
              }
            }
            if (mergedAnything) break
          }
          if (mergedAnything) break
        }
        if (mergedAnything) break
      }
      if (mergedAnything) break
    }

    if (!mergedAnything) {
      this.solved = true
    }
  }

  getOutput() {
    return {
      allTracesMerged: Object.values(this.correctedTraceMap),
    }
  }

  override visualize() {
    const graphics = visualizeInputProblem(this.inputProblem)
    graphics.circles = graphics.circles || []

    for (const trace of Object.values(this.correctedTraceMap)) {
      graphics.lines!.push({
        points: trace.tracePath,
        strokeColor: "magenta",
      })
    }

    return graphics
  }
}
