import { expect, test, beforeAll, afterAll } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import "../index"

const testSvgs = [
  `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>`,
  `<svg width="400" height="110" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="patt1" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="10" fill="red" />
    </pattern>
  </defs>

  <rect width="200" height="100" x="0" y="0" stroke="black" fill="url(#patt1)" />
</svg>
`,
  `<svg height="220" width="500" xmlns="http://www.w3.org/2000/svg">
  <polygon points="100,10 150,190 50,190" style="fill:lime;stroke:purple;stroke-width:3" />
</svg>`,
]

const svgNames: string[] = []
for (let i = 0; i < testSvgs.length; i++) svgNames.push(`test${i + 1}`)

const snapshotDir = path.join(__dirname, "__snapshots__")
const snapshotPaths = svgNames.map((svgName) =>
  path.join(snapshotDir, `${svgName}.snap.svg`),
)

beforeAll(() => {
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true })
  }
})

afterAll(() => {
  for (const snapshotPath of snapshotPaths)
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath)
    }
  if (fs.existsSync(snapshotDir)) {
    fs.rmdirSync(snapshotDir, { recursive: true })
  }
})

test("toMatchMultipleSvgSnapshots creates and matches snapshots", async () => {
  // First run: create snapshot
  await expect(testSvgs).toMatchMultipleSvgSnapshots(import.meta.path, svgNames)

  // Verify snapshot was created
  for (const snapshotPath of snapshotPaths)
    expect(fs.existsSync(snapshotPath)).toBe(true)

  // Second run: match existing snapshot
  await expect(testSvgs).toMatchMultipleSvgSnapshots(import.meta.path, svgNames)
})
