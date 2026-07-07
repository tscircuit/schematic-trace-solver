import path from "node:path"
import { readFile } from "node:fs/promises"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import { PipelineStageDebugRunner } from "lib/testing/PipelineStageDebugRunner"
import type { InputProblem } from "lib/types/InputProblem"

type Options = {
  inputPath: string
  outDir?: string
  stopAfterStage?: string
  pngSize: number
  writePng: boolean
  writeSvg: boolean
  writeGraphicsJson: boolean
  writeStepPngs: boolean
}

function printUsage() {
  console.log(`Usage: bun run debug:pipeline <input.json> [options]

Options:
  --out <dir>              Output directory
  --stop-after <stage|n>   Stop after a stage name or 1-based stage number
  --png-size <px>          PNG width and height, default 1536
  --no-png                 Do not write .png files
  --svg                    Also write .svg files
  --no-json                Do not write .graphics.json files
  --step-pngs              Also write one PNG per graphics step when step values exist

Example:
  bun run debug:pipeline tests/assets/example01.json
`)
}

function parseArgs(argv: string[]): Options {
  const args = [...argv]
  const inputPath = args.shift()
  if (!inputPath || inputPath === "--help" || inputPath === "-h") {
    printUsage()
    process.exit(inputPath ? 0 : 1)
  }

  const options: Options = {
    inputPath,
    pngSize: 1536,
    writePng: true,
    writeSvg: false,
    writeGraphicsJson: true,
    writeStepPngs: false,
  }

  while (args.length > 0) {
    const arg = args.shift()
    if (arg === "--out") {
      options.outDir = args.shift()
      if (!options.outDir) throw new Error("--out requires a directory")
      continue
    }
    if (arg === "--stop-after") {
      options.stopAfterStage = args.shift()
      if (!options.stopAfterStage) {
        throw new Error("--stop-after requires a stage name or number")
      }
      continue
    }
    if (arg === "--png-size") {
      const pngSize = Number(args.shift())
      if (!Number.isFinite(pngSize) || pngSize <= 0) {
        throw new Error("--png-size requires a positive number")
      }
      options.pngSize = pngSize
      continue
    }
    if (arg === "--no-png") {
      options.writePng = false
      continue
    }
    if (arg === "--svg") {
      options.writeSvg = true
      continue
    }
    if (arg === "--no-json") {
      options.writeGraphicsJson = false
      continue
    }
    if (arg === "--step-pngs") {
      options.writeStepPngs = true
      continue
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

function getDefaultOutputDir(inputPath: string) {
  const basename = path.basename(inputPath).replace(/\.json$/i, "")
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  return path.resolve(
    process.cwd(),
    "tmp",
    "schematic-trace-debug",
    `${basename}-${timestamp}`,
  )
}

const options = parseArgs(process.argv.slice(2))
const inputPath = path.resolve(process.cwd(), options.inputPath)
const inputProblem = JSON.parse(
  await readFile(inputPath, "utf8"),
) as InputProblem
const outputDir = options.outDir
  ? path.resolve(process.cwd(), options.outDir)
  : getDefaultOutputDir(inputPath)
const solver = new SchematicTracePipelineSolver(inputProblem)

const runner = new PipelineStageDebugRunner({
  pipelineSolver: solver,
  outputDir,
  writeGraphicsJson: options.writeGraphicsJson,
  writePng: options.writePng,
  writeSvg: options.writeSvg,
  pngWidth: options.pngSize,
  pngHeight: options.pngSize,
  writeStepPngs: options.writeStepPngs,
  stopAfterStage: options.stopAfterStage,
  context: {
    inputPath: path.relative(process.cwd(), inputPath),
    stopAfterStage: options.stopAfterStage ?? "",
    writePng: options.writePng,
    writeSvg: options.writeSvg,
    writeGraphicsJson: options.writeGraphicsJson,
    writeStepPngs: options.writeStepPngs,
    pngSize: options.pngSize,
  },
  onLog: (line) => console.log(line),
})

const result = await runner.run()

console.log(`\nWrote ${result.stageArtifacts.length} stage artifact(s).`)
console.log(`Output: ${path.relative(process.cwd(), result.outputDir)}`)

if (result.error) {
  process.exitCode = 1
}
