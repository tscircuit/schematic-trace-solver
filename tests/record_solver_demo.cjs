const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");

const inputProblem = {
  chips: [
    {
      chipId: "C2",
      center: { x: 0, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C2.1", x: 0, y: 0.5 },
        { pinId: "C2.2", x: 0, y: -0.5 }
      ]
    },
    {
      chipId: "C1",
      center: { x: 2, y: 0 },
      width: 0.5,
      height: 1,
      pins: [
        { pinId: "C1.1", x: 2, y: 0.5 },
        { pinId: "C1.2", x: 2, y: -0.5 }
      ]
    }
  ],
  directConnections: [],
  netConnections: [
    { netId: "GND", pinIds: ["C1.1", "C2.1"] },
    { netId: "VCC", pinIds: ["C1.2", "C2.2"] }
  ],
  availableNetLabelOrientations: {
    GND: ["y+"],
    VCC: ["y-"]
  },
  maxMspPairDistance: 2
};

async function main() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  
  const videoDir = path.join(__dirname, "assets");
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();
  
  try {
    console.log("Navigating to parent Cosmos page...");
    const fixtureParam = JSON.stringify({ path: "site/PasteInput.page.tsx" });
    await page.goto(`http://localhost:5020/?fixture=${encodeURIComponent(fixtureParam)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    console.log("Locating iframe...");
    const iframe = page.frameLocator('iframe[data-testid="previewIframe"]');

    console.log("Locating textarea on the page...");
    const textarea = iframe.locator('textarea[placeholder="Paste your InputProblem here..."]');
    await textarea.waitFor({ state: 'visible', timeout: 10000 });
    
    console.log("Pasting InputProblem JSON...");
    await textarea.fill(JSON.stringify(inputProblem, null, 2));
    await page.waitForTimeout(1000);

    console.log("Clicking Open Debugger...");
    await iframe.locator('button:has-text("Open Debugger")').click();
    await page.waitForTimeout(2000);

    console.log("Showing solved schematic pipeline (no traces between C1 and C2, only net labels)...");
    await page.waitForTimeout(6000);

  } catch (error) {
    console.error("An error occurred during automation:", error);
    await page.screenshot({ path: path.join(videoDir, "debug_screenshot.png") });
    const content = await page.content();
    console.log("Page Content HTML length:", content.length);
    fs.writeFileSync(path.join(videoDir, "debug_content.html"), content);
  } finally {
    console.log("Closing context and saving video...");
    await context.close();
    await browser.close();
    
    const files = fs.readdirSync(videoDir);
    const videoFile = files.find(f => f.endsWith(".webm") && f !== "repro79_demo.webm");
    if (videoFile) {
      const oldPath = path.join(videoDir, videoFile);
      const newPath = path.join(videoDir, "repro79_demo.webm");
      if (fs.existsSync(newPath)) {
        fs.unlinkSync(newPath);
      }
      fs.renameSync(oldPath, newPath);
      console.log(`Video demo successfully saved and renamed to: ${newPath}`);
    } else {
      console.log("Video file not found or not created.");
    }
  }
}

main();
