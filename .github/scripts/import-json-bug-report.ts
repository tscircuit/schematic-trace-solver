import fs from "node:fs"
import path from "node:path"
import {
  assertInputProblem,
  normalizeBugReportInputProblem,
} from "./normalizeBugReportJson"

export { assertInputProblem, normalizeBugReportInputProblem }

type IssueEvent = {
  issue: {
    number: number
    created_at: string
    body?: string | null
    labels?: Array<string | { name?: string }>
  }
}

type JsonLinkCandidate = {
  label?: string
  url: string
}

const repoRoot = process.cwd()
const eventPath = process.env["GITHUB_EVENT_PATH"]
const githubOutputPath = process.env["GITHUB_OUTPUT"]
const githubToken =
  process.env["TSCIRCUIT_BOT_GITHUB_TOKEN"] || process.env["GITHUB_TOKEN"]
const maxAttachmentBytes = 10 * 1024 * 1024

async function main() {
  if (!eventPath) {
    throw new Error("GITHUB_EVENT_PATH is not set")
  }

  const event = JSON.parse(fs.readFileSync(eventPath, "utf-8")) as IssueEvent
  const issue = event.issue

  if (!issue) {
    throw new Error("This workflow must be run from an issue event")
  }

  const body = issue.body ?? ""
  if (!isJsonBugReportIssue(issue, body)) {
    writeOutput("skipped", "true")
    writeOutput("skip_reason", "Issue is not from the JSON Bug Report form")
    console.log("Skipping issue because it is not a JSON Bug Report")
    return
  }

  const timestamp = getTimestampFromCreatedAt(issue.created_at)
  const reportId = `bug-report-${timestamp}`
  const branchName = `json-bug-report/${reportId}`
  const reportDir = path.join("tests", "bug-reports", reportId)
  const siteReportDir = path.join("site", "bug-reports")
  const reportDirAbs = path.join(repoRoot, reportDir)
  const jsonPath = path.join(reportDir, `${reportId}.json`)
  const testPath = path.join(reportDir, `${reportId}.test.ts`)
  const pagePath = path.join(siteReportDir, `${reportId}.page.tsx`)

  writeOutput("report_id", reportId)
  writeOutput("branch_name", branchName)
  writeOutput("report_dir", reportDir)
  writeOutput("site_report_dir", siteReportDir)
  writeOutput("json_path", jsonPath)
  writeOutput("test_path", testPath)
  writeOutput("page_path", pagePath)

  if (fs.existsSync(reportDirAbs)) {
    writeOutput("created", "false")
    writeOutput("skipped", "true")
    writeOutput("skip_reason", `${reportDir} already exists`)
    console.log(`${reportDir} already exists; no files generated`)
    return
  }

  const jsonAttachment = await getJsonAttachment(body)
  const inputProblem = normalizeBugReportInputProblem(jsonAttachment.value)

  fs.mkdirSync(reportDirAbs, { recursive: true })
  fs.mkdirSync(path.join(repoRoot, siteReportDir), { recursive: true })
  fs.writeFileSync(
    path.join(repoRoot, jsonPath),
    `${JSON.stringify(inputProblem, null, 2)}\n`,
  )
  fs.writeFileSync(path.join(repoRoot, testPath), getTestFile(reportId))
  fs.writeFileSync(path.join(repoRoot, pagePath), getPageFile(reportId))

  writeOutput("created", "true")
  writeOutput("attachment_url", jsonAttachment.url)
  console.log(`Generated ${jsonPath}, ${testPath}, and ${pagePath}`)
}

function isJsonBugReportIssue(issue: IssueEvent["issue"], body: string) {
  const labelNames = issue.labels?.map((label) => {
    if (typeof label === "string") return label
    return label.name ?? ""
  })

  return (
    labelNames?.includes("json-bug-report") ||
    body.includes("### Solver input JSON attachment")
  )
}

function getTimestampFromCreatedAt(createdAt: string) {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Could not parse issue created_at timestamp: ${createdAt}`)
  }

  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replaceAll("-", "")
    .replaceAll(":", "")
}

async function getJsonAttachment(body: string) {
  const candidates = getJsonLinkCandidates(body)

  if (candidates.length === 0) {
    throw new Error(
      "No .json GitHub user attachment was found in the issue body. Attach a JSON file to the 'Solver input JSON attachment' field and edit the issue to retry.",
    )
  }

  const errors: string[] = []

  for (const candidate of candidates) {
    try {
      const content = await downloadGitHubUserAttachment(candidate.url)
      return {
        url: candidate.url,
        value: JSON.parse(content),
      }
    } catch (error) {
      errors.push(
        `${candidate.label ?? candidate.url}: ${getErrorMessage(error)}`,
      )
    }
  }

  throw new Error(
    `Could not download and parse a JSON attachment.\n\n${errors.join("\n")}`,
  )
}

function getJsonLinkCandidates(body: string): JsonLinkCandidate[] {
  const candidates: JsonLinkCandidate[] = []
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g
  let markdownMatch = markdownLinkRegex.exec(body)

  while (markdownMatch) {
    candidates.push({
      label: markdownMatch[1],
      url: cleanupUrl(markdownMatch[2]!),
    })
    markdownMatch = markdownLinkRegex.exec(body)
  }

  const bareUrlRegex = /https?:\/\/[^\s<>)"']+/g
  let bareUrlMatch = bareUrlRegex.exec(body)

  while (bareUrlMatch) {
    candidates.push({ url: cleanupUrl(bareUrlMatch[0]) })
    bareUrlMatch = bareUrlRegex.exec(body)
  }

  const seen = new Set<string>()
  const filtered: JsonLinkCandidate[] = []

  for (const candidate of candidates) {
    if (!isAllowedGitHubUserAttachment(candidate.url)) continue
    if (!isJsonAttachmentCandidate(candidate)) continue
    if (seen.has(candidate.url)) continue
    seen.add(candidate.url)
    filtered.push(candidate)
  }

  return filtered
}

function cleanupUrl(url: string) {
  return url.replace(/[.,;]+$/, "")
}

function isAllowedGitHubUserAttachment(url: string) {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "github.com" &&
      parsed.pathname.startsWith("/user-attachments/")
    )
  } catch {
    return false
  }
}

function isJsonAttachmentCandidate(candidate: JsonLinkCandidate) {
  return [candidate.label, candidate.url].some((value) =>
    /\.json(?:[?#].*)?$/i.test(value ?? ""),
  )
}

async function downloadGitHubUserAttachment(url: string, redirectCount = 0) {
  if (redirectCount > 5) {
    throw new Error("Too many redirects while downloading attachment")
  }

  const parsed = new URL(url)
  const headers: Record<string, string> = {
    Accept: "application/octet-stream",
    "User-Agent": "schematic-trace-solver-json-bug-report-importer",
  }

  if (githubToken && parsed.hostname === "github.com") {
    headers["Authorization"] = `Bearer ${githubToken}`
  }

  const response = await fetch(url, {
    headers,
    redirect: "manual",
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location")

    if (!location) {
      throw new Error(
        `Attachment download redirected without a Location header`,
      )
    }

    return downloadGitHubUserAttachment(
      new URL(location, url).toString(),
      redirectCount + 1,
    )
  }

  if (!response.ok) {
    throw new Error(
      `Attachment download failed with HTTP ${response.status} ${response.statusText}`,
    )
  }

  const contentLength = Number(response.headers.get("content-length"))

  if (Number.isFinite(contentLength) && contentLength > maxAttachmentBytes) {
    throw new Error(
      `Attachment is larger than the ${maxAttachmentBytes} byte limit`,
    )
  }

  const content = await response.text()

  if (content.length > maxAttachmentBytes) {
    throw new Error(
      `Attachment is larger than the ${maxAttachmentBytes} byte limit`,
    )
  }

  return content
}

function getTestFile(reportId: string) {
  return `import { expect, test } from "bun:test"
import { SchematicTracePipelineSolver } from "lib/solvers/SchematicTracePipelineSolver/SchematicTracePipelineSolver"
import inputProblem from "./${reportId}.json"
import "tests/fixtures/matcher"

test("${reportId}", () => {
  const solver = new SchematicTracePipelineSolver(inputProblem as any)

  solver.solve()

  expect(solver).toMatchSolverSnapshot(import.meta.path)
})
`
}

function getPageFile(reportId: string) {
  return `import { PipelineDebugger } from "site/components/PipelineDebugger"
import inputProblem from "../../tests/bug-reports/${reportId}/${reportId}.json"

export default () => <PipelineDebugger inputProblem={inputProblem as any} />
`
}

function writeOutput(key: string, value: string) {
  if (!githubOutputPath) return
  fs.appendFileSync(githubOutputPath, `${key}=${value}\n`)
}

function writeFailureSummary(error: unknown) {
  const message = getErrorMessage(error)
  fs.writeFileSync(
    path.join(repoRoot, "bug-report-error.md"),
    `The JSON bug report import failed before a pull request could be opened.\n\n${message}\n`,
  )
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

if (import.meta.main) {
  main().catch((error) => {
    writeFailureSummary(error)
    console.error(error)
    process.exit(1)
  })
}
