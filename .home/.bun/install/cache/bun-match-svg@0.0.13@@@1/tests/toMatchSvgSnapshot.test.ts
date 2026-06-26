import { expect, test, beforeAll, afterAll } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import "../index"

const testSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>`

const snapshotDir = path.join(__dirname, "__snapshots__")
const snapshotPath = path.join(snapshotDir, "test.snap.svg")
const metadataSnapshotPath = path.join(snapshotDir, "metadata.snap.svg")

beforeAll(() => {
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true })
  }
})

afterAll(() => {
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath)
  }
  if (fs.existsSync(metadataSnapshotPath)) {
    fs.unlinkSync(metadataSnapshotPath)
  }
  if (fs.existsSync(snapshotDir)) {
    fs.rmdirSync(snapshotDir, { recursive: true })
  }
})

test("toMatchSvgSnapshot creates and matches snapshot", async () => {
  // First run: create snapshot
  await expect(testSvg).toMatchSvgSnapshot(import.meta.path, "test")

  // Verify snapshot was created
  expect(fs.existsSync(snapshotPath)).toBe(true)

  // Second run: match existing snapshot
  await expect(testSvg).toMatchSvgSnapshot(import.meta.path, "test")
})

test("does not update snapshot when visually identical", async () => {
  const svgWithComment = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <!-- comment -->
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>`

  await expect(testSvg).toMatchSvgSnapshot(import.meta.path, "metadata")
  const original = fs.readFileSync(metadataSnapshotPath, "utf-8")

  await expect(svgWithComment).toMatchSvgSnapshot(import.meta.path, "metadata")
  const updated = fs.readFileSync(metadataSnapshotPath, "utf-8")
  expect(updated).toBe(original)
})

// test("toMatchSvgSnapshot detects differences", async () => {
//   const modifiedSvg = testSvg.replace('r="40"', 'r="30"')

//   // This should fail and create a diff
//   await expect(
//     expect(modifiedSvg).toMatchSvgSnapshot(import.meta.path, "test")
//   ).rejects.toThrow("Snapshot does not match")

//   // Verify diff was created
//   const diffPath = snapshotPath.replace(".snap.svg", ".diff.png")
//   expect(fs.existsSync(diffPath)).toBe(true)

//   // Clean up diff
//   fs.unlinkSync(diffPath)
// })
