import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  getPngBufferFromGraphicsObject,
  getSvgFromGraphicsObject,
} from "graphics-debug"
import type { GraphicsObject } from "graphics-debug"
import { BaseSolver } from "lib/solvers/BaseSolver/BaseSolver"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"

type PipelineStepLike = {
  solverName: string
}

type VisualizingSolver = {
  visualize: () => GraphicsObject
  iterations?: number
  error?: string | null
  solved?: boolean
  failed?: boolean
}

export type PipelineStageArtifact = {
  stageName: string
  stageNumber: number
  pngPath?: string
  svgPath?: string
  graphicsJsonPath?: string
  stepPngPaths: string[]
}

export type PipelineStageDebugRunnerResult = {
  outputDir: string
  logsPath: string
  stageArtifacts: PipelineStageArtifact[]
  solved: boolean
  failed: boolean
  error: string | null
  stoppedAfterStage: string | null
}

export class PipelineStageDebugRunner {
  readonly pipelineSolver: SchematicTracePipelineSolver
  readonly outputDir: string
  readonly logsPath: string
  readonly pngWidth: number
  readonly pngHeight: number
  readonly writePng: boolean
  readonly writeSvg: boolean
  readonly writeGraphicsJson: boolean
  readonly writeStepPngs: boolean
  readonly stopAfterStage?: string
  readonly context: Record<string, string | number | boolean | null | undefined>
  readonly onLog?: (line: string) => void

  private readonly stageArtifacts: PipelineStageArtifact[] = []
  private readonly capturedStageNumbers = new Set<number>()

  constructor(opts: {
    pipelineSolver: SchematicTracePipelineSolver
    outputDir: string
    pngWidth?: number
    pngHeight?: number
    writePng?: boolean
    writeSvg?: boolean
    writeGraphicsJson?: boolean
    writeStepPngs?: boolean
    stopAfterStage?: string
    context?: Record<string, string | number | boolean | null | undefined>
    onLog?: (line: string) => void
  }) {
    this.pipelineSolver = opts.pipelineSolver
    this.outputDir = opts.outputDir
    this.logsPath = path.join(this.outputDir, "logs.txt")
    this.pngWidth = opts.pngWidth ?? 1536
    this.pngHeight = opts.pngHeight ?? 1536
    this.writePng = opts.writePng ?? true
    this.writeSvg = opts.writeSvg ?? false
    this.writeGraphicsJson = opts.writeGraphicsJson ?? true
    this.writeStepPngs = opts.writeStepPngs ?? false
    this.stopAfterStage = opts.stopAfterStage
    this.context = opts.context ?? {}
    this.onLog = opts.onLog
  }

  async run(): Promise<PipelineStageDebugRunnerResult> {
    await mkdir(this.outputDir, { recursive: true })
    await writeFile(this.logsPath, "")

    await this.log(`startedAt=${new Date().toISOString()}`)
    await this.log(`outputDir=${this.toDisplayPath(this.outputDir)}`)
    await this.log(
      `artifacts png=${this.writePng} svg=${this.writeSvg} graphicsJson=${this.writeGraphicsJson} stepPngs=${this.writeStepPngs} pngSize=${this.pngWidth}x${this.pngHeight}`,
    )
    for (const [key, value] of Object.entries(this.context)) {
      await this.log(`${key}=${value ?? ""}`)
    }

    let stoppedAfterStage: string | null = null
    let thrownError: unknown = null

    await this.log(
      this.getStageEnterLogLine(this.pipelineSolver.getCurrentPhase(), 0),
    )

    while (!this.pipelineSolver.solved && !this.pipelineSolver.failed) {
      const previousStageNumber = this.pipelineSolver.currentPipelineStepIndex
      const previousStageName = this.pipelineSolver.getCurrentPhase()

      try {
        this.pipelineSolver.step()
      } catch (error) {
        thrownError = error
      }

      const currentStageNumber = this.pipelineSolver.currentPipelineStepIndex
      const currentStageName = this.pipelineSolver.getCurrentPhase()

      if (
        currentStageNumber !== previousStageNumber &&
        previousStageName !== "none"
      ) {
        await this.captureStage(previousStageNumber)
        if (
          previousStageName === this.stopAfterStage ||
          String(previousStageNumber + 1) === this.stopAfterStage
        ) {
          stoppedAfterStage = previousStageName
          break
        }
      }

      if (
        currentStageNumber !== previousStageNumber &&
        currentStageName !== "none"
      ) {
        await this.log(
          this.getStageEnterLogLine(currentStageName, currentStageNumber),
        )
      }

      if (thrownError) break
    }

    if (this.pipelineSolver.failed) {
      await this.captureActiveStage()
    }

    if (thrownError) {
      await this.log(`thrownError=${this.formatError(thrownError)}`)
    }

    const status = stoppedAfterStage
      ? "stopped"
      : this.pipelineSolver.solved
        ? "solved"
        : this.pipelineSolver.failed
          ? "failed"
          : "incomplete"

    await this.log(
      `completed status=${status} iterations=${this.pipelineSolver.iterations} error=${this.pipelineSolver.error ?? ""}`,
    )

    return {
      outputDir: this.outputDir,
      logsPath: this.logsPath,
      stageArtifacts: [...this.stageArtifacts],
      solved: this.pipelineSolver.solved,
      failed: this.pipelineSolver.failed,
      error:
        this.pipelineSolver.error ??
        (thrownError ? this.formatError(thrownError) : null),
      stoppedAfterStage,
    }
  }

  private async captureActiveStage() {
    const stageNumber = this.pipelineSolver.currentPipelineStepIndex
    if (this.pipelineSolver.getCurrentPhase() === "none") return
    if (this.capturedStageNumbers.has(stageNumber)) return

    await this.captureStage(stageNumber, this.pipelineSolver.activeSubSolver)
  }

  private async captureStage(stageNumber: number, solver?: BaseSolver | null) {
    if (this.capturedStageNumbers.has(stageNumber)) return

    const stageDef = this.getStageDef(stageNumber)
    if (!stageDef) return

    const stageSolver = solver ?? this.getStageSolver(stageDef.solverName)
    if (!stageSolver) {
      throw new Error(
        `Unable to resolve solver for stage ${stageNumber + 1} "${stageDef.solverName}"`,
      )
    }

    const basePath = path.join(
      this.outputDir,
      `stage${String(stageNumber + 1).padStart(2, "0")}-${this.getSafeStageName(stageDef.solverName)}`,
    )
    const pngPath = this.writePng ? `${basePath}.png` : undefined
    const svgPath = this.writeSvg ? `${basePath}.svg` : undefined
    const graphicsJsonPath = this.writeGraphicsJson
      ? `${basePath}.graphics.json`
      : undefined
    const graphics = stageSolver.visualize()
    const svg = getSvgFromGraphicsObject(graphics, { backgroundColor: "white" })

    if (pngPath) {
      await writeFile(pngPath, await this.renderGraphicsToPng(graphics))
    }

    const stepPngPaths =
      this.writeStepPngs && this.writePng
        ? await this.writeStepPngsForGraphics(basePath, graphics)
        : []

    if (svgPath) {
      await writeFile(svgPath, svg)
    }

    if (graphicsJsonPath) {
      await writeFile(graphicsJsonPath, JSON.stringify(graphics, null, 2))
    }

    this.capturedStageNumbers.add(stageNumber)
    const artifact = {
      stageName: stageDef.solverName,
      stageNumber: stageNumber + 1,
      pngPath,
      svgPath,
      graphicsJsonPath,
      stepPngPaths,
    } satisfies PipelineStageArtifact
    this.stageArtifacts.push(artifact)

    await this.log(
      `captured stage=${artifact.stageNumber} name=${artifact.stageName} iterations=${stageSolver.iterations ?? 0} png=${pngPath ? this.toDisplayPath(pngPath) : ""} svg=${svgPath ? this.toDisplayPath(svgPath) : ""} steps=${stepPngPaths.length}`,
    )
  }

  private async writeStepPngsForGraphics(
    basePath: string,
    graphics: GraphicsObject,
  ): Promise<string[]> {
    const stepPngPaths: string[] = []

    for (const step of this.getObjectSteps(graphics)) {
      const stepPngPath = `${basePath}.step-${step}.png`
      await writeFile(
        stepPngPath,
        await this.renderGraphicsToPng(
          this.filterGraphicsByStep(graphics, step),
        ),
      )
      stepPngPaths.push(stepPngPath)
    }

    return stepPngPaths
  }

  private renderGraphicsToPng(graphics: GraphicsObject): Promise<Uint8Array> {
    return getPngBufferFromGraphicsObject(graphics, {
      backgroundColor: "white",
      pngWidth: this.pngWidth,
      pngHeight: this.pngHeight,
    })
  }

  private getObjectSteps(graphics: GraphicsObject): number[] {
    const steps = new Set<number>()
    for (const objects of this.getGraphicsObjectArrays(graphics)) {
      for (const object of objects) {
        if (typeof object.step === "number") steps.add(object.step)
      }
    }

    return [...steps].sort((a, b) => a - b)
  }

  private filterGraphicsByStep(
    graphics: GraphicsObject,
    step: number,
  ): GraphicsObject {
    const filtered: Record<string, unknown[]> = {}

    for (const key of Object.keys(graphics)) {
      const value = (graphics as Record<string, unknown>)[key]
      filtered[key] = Array.isArray(value)
        ? value.filter((object) => {
            return (
              typeof object === "object" &&
              object !== null &&
              (object as { step?: number }).step === step
            )
          })
        : []
    }

    return filtered as GraphicsObject
  }

  private getGraphicsObjectArrays(
    graphics: GraphicsObject,
  ): Array<Array<{ step?: number }>> {
    return Object.values(graphics).filter(Array.isArray) as Array<
      Array<{ step?: number }>
    >
  }

  private getStageDef(stageNumber: number): PipelineStepLike | undefined {
    return this.pipelineSolver.pipelineDef[stageNumber]
  }

  private getStageSolver(stageName: string): VisualizingSolver | undefined {
    return (
      this.pipelineSolver as unknown as Record<string, VisualizingSolver>
    )[stageName]
  }

  private getSafeStageName(stageName: string): string {
    return stageName.replace(/[^a-zA-Z0-9._-]/g, "_")
  }

  private getStageEnterLogLine(stageName: string, stageNumber: number) {
    return `enter stage=${stageNumber + 1} name=${stageName}`
  }

  private async log(line: string) {
    await writeFile(this.logsPath, `${line}\n`, { flag: "a" })
    this.onLog?.(line)
  }

  private toDisplayPath(filePath: string): string {
    return path.relative(process.cwd(), filePath) || "."
  }

  private formatError(error: unknown) {
    if (error instanceof Error) return `${error.name}: ${error.message}`
    return String(error)
  }
}
