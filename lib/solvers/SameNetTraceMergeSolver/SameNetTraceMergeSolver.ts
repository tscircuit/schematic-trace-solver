import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { visualizeInputProblem } from "../SchematicTracePipelineSolver/visualizeInputProblem"
import type { InputProblem } from "lib/types/InputProblem"
import type { SolvedTracePath } from "../SchematicTraceLinesSolver/SchematicTraceLinesSolver"
import type { ConnectivityMap } from "connectivity-map"

export class SameNetTraceMergeSolver extends BaseSolver {
    inputProblem: InputProblem
    inputTracePaths: Array<SolvedTracePath>
    globalConnMap: ConnectivityMap
    correctedTraceMap: Record<string, SolvedTracePath> = {}

    constructor(params: { inputProblem: InputProblem; inputTracePaths: Array<SolvedTracePath>; globalConnMap: ConnectivityMap }) {
        super()
        this.inputProblem = params.inputProblem
        this.inputTracePaths = params.inputTracePaths
        this.globalConnMap = params.globalConnMap
        for (const tracePath of this.inputTracePaths) {
            this.correctedTraceMap[tracePath.mspPairId] = { ...tracePath, tracePath: [...tracePath.tracePath] }
        }
    }

    override getConstructorParams(): ConstructorParameters<typeof SameNetTraceMergeSolver>[0] {
        return { inputProblem: this.inputProblem, inputTracePaths: this.inputTracePaths, globalConnMap: this.globalConnMap }
    }

    override _step() {
        const MERGE_THRESHOLD = 0.5
        let mergedSomething = false
        const traceKeys = Object.keys(this.correctedTraceMap)

        for (let i = 0; i < traceKeys.length; i++) {
            for (let j = i; j < traceKeys.length; j++) {
                const keyA = traceKeys[i]!
                const keyB = traceKeys[j]!
                const pathA = this.correctedTraceMap[keyA]!
                const pathB = this.correctedTraceMap[keyB]!

                if (pathA.globalConnNetId !== pathB.globalConnNetId) continue
                const ptsA = pathA.tracePath
                const ptsB = pathB.tracePath

                for (let sa = 0; sa < ptsA.length - 1; sa++) {
                    const a1 = ptsA[sa]!
                    const a2 = ptsA[sa + 1]!
                    const aVert = Math.abs(a1.x - a2.x) < 1e-3
                    const aHorz = Math.abs(a1.y - a2.y) < 1e-3
                    if (!aVert && !aHorz) continue

                    const minA_x = Math.min(a1.x, a2.x)
                    const maxA_x = Math.max(a1.x, a2.x)
                    const minA_y = Math.min(a1.y, a2.y)
                    const maxA_y = Math.max(a1.y, a2.y)

                    for (let sb = 0; sb < ptsB.length - 1; sb++) {
                        if (keyA === keyB && sa === sb) continue
                        const b1 = ptsB[sb]!
                        const b2 = ptsB[sb + 1]!
                        const bVert = Math.abs(b1.x - b2.x) < 1e-3
                        const bHorz = Math.abs(b1.y - b2.y) < 1e-3
                        if (!bVert && !bHorz) continue

                        const minB_x = Math.min(b1.x, b2.x)
                        const maxB_x = Math.max(b1.x, b2.x)
                        const minB_y = Math.min(b1.y, b2.y)
                        const maxB_y = Math.max(b1.y, b2.y)

                        if (aVert && bVert) {
                            const dx = Math.abs(a1.x - b1.x)
                            if (dx > 0.001 && dx < MERGE_THRESHOLD) {
                                const overlap = Math.min(maxA_y, maxB_y) - Math.max(minA_y, minB_y)
                                if (overlap > 0) { b1.x = a1.x; b2.x = a1.x; mergedSomething = true }
                            }
                        } else if (aHorz && bHorz) {
                            const dy = Math.abs(a1.y - b1.y)
                            if (dy > 0.001 && dy < MERGE_THRESHOLD) {
                                const overlap = Math.min(maxA_x, maxB_x) - Math.max(minA_x, minB_x)
                                if (overlap > 0) { b1.y = a1.y; b2.y = a1.y; mergedSomething = true }
                            }
                        }
                    }
                }
            }
        }
        if (!mergedSomething) this.solved = true
    }
    getOutput() { return { traces: Object.values(this.correctedTraceMap) } }
    override visualize() {
        const graphics = visualizeInputProblem(this.inputProblem)
        for (const trace of Object.values(this.correctedTraceMap)) graphics.lines!.push({ points: trace.tracePath, strokeColor: "teal" })
        return graphics
    }
}
