#!/usr/bin/env bun

import { mkdir, writeFile, access } from "node:fs/promises"
import { spawn } from "node:child_process"

const EXAMPLE_TEST = `import { expect, test } from "bun:test"                                                             
                                                                                                                           
 const testSvg = \`<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">                                       
   <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />                                            
 </svg>\`                                                                                                                  
                                                                                                                           
 test("svg snapshot example", async () => {                                                                                
   // First run will create the snapshot                                                                                   
   // Subsequent runs will compare against the saved snapshot                                                              
   await expect(testSvg).toMatchSvgSnapshot(import.meta.path)                                                   
 })                                                                                                                        
 `     

const PRELOAD_FILE = `import "bun-match-svg"`

const BUNFIG = `[test]
preload = ["./tests/fixtures/preload.ts"]`

async function installDependency() {
  return new Promise((resolve, reject) => {
    const install = spawn('bun', ['add', '-d', 'bun-match-svg'], {
      stdio: 'inherit'
    })

    install.on('close', (code) => {
      if (code === 0) {
        resolve(undefined)
      } else {
        reject(new Error(`Installation failed with code ${code}`))
      }
    })
  })
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function init() {
  try {
    console.log("📦 Installing bun-match-svg...")
    await installDependency()
    
    await mkdir("tests/fixtures", { recursive: true })

    if (!await fileExists("tests/svg.test.ts")) {
      await writeFile("tests/svg.test.ts", EXAMPLE_TEST)
      console.log("✅ Created example test in tests/svg.test.ts")
    } else {
      console.log("🔒 tests/svg.test.ts already exists, skipping.")
    }

    if (!await fileExists("tests/fixtures/preload.ts")) {
      await writeFile("tests/fixtures/preload.ts", PRELOAD_FILE)
      console.log("✅ Created preload file in tests/fixtures/preload.ts")
    } else {
      console.log("🔒 tests/fixtures/preload.ts already exists, skipping.")
    }

    if (!await fileExists("bunfig.toml")) {
      await writeFile("bunfig.toml", BUNFIG)
      console.log("✅ Created bunfig.toml")
    } else {
      console.log("🔒 bunfig.toml already exists, skipping.")
    }

    console.log("\n🎉 You can now run: bun test")
  } catch (error) {
    console.error("❌ Error during initialization:", error)
    process.exit(1)
  }
}

const command = process.argv[2]

if (command === "init") {
  init().catch(console.error)
} else {
  console.log("Usage: bunx bun-match-svg init")
}
