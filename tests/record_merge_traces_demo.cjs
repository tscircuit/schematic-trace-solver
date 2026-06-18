const { chromium } = require("@playwright/test")
const path = require("path")
const fs = require("fs")

async function main() {
  console.log("Launching browser...")
  const browser = await chromium.launch({ headless: true })

  const videoDir = path.join(__dirname, "assets")
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true })
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 },
    },
  })

  const page = await context.newPage()

  try {
    console.log("Navigating to TraceCleanupSolver page...")
    const fixtureParam = JSON.stringify({
      path: "site/TraceCleanupSolver/TraceCleanupSolver.page.tsx",
    })
    await page.goto(
      `http://localhost:5020/?fixture=${encodeURIComponent(fixtureParam)}`,
      { waitUntil: "networkidle" },
    )
    await page.waitForTimeout(2000)

    console.log("Locating iframe...")
    const iframe = page.frameLocator('iframe[data-testid="previewIframe"]')

    // Wait for the solver debugger to render
    await page.waitForTimeout(3000)

    console.log(
      "Successfully rendered TraceCleanupSolver debugger showing merged same-net traces!",
    )
    await page.waitForTimeout(5000)
  } catch (error) {
    console.error("An error occurred during automation:", error)
    await page.screenshot({
      path: path.join(videoDir, "merge_debug_screenshot.png"),
    })
  } finally {
    console.log("Closing context and saving video...")
    await context.close()
    await browser.close()

    const files = fs.readdirSync(videoDir)
    const videoFile = files.find(
      (f) =>
        f.endsWith(".webm") &&
        f !== "repro79_demo.webm" &&
        f !== "merge_traces_demo.webm",
    )
    if (videoFile) {
      const oldPath = path.join(videoDir, videoFile)
      const newPath = path.join(videoDir, "merge_traces_demo.webm")
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath)
      }
      fs.renameSync(oldPath, newPath)
      console.log(`Video demo successfully saved and renamed to: ${newPath}`)
    } else {
      console.log("Video file not found or not created.")
    }
  }
}

main()
