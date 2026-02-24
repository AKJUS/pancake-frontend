import { describe, it, expect } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

async function getAllFiles(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', '.git', 'coverage'].includes(entry.name)) {
        continue
      }
      // eslint-disable-next-line no-await-in-loop
      await getAllFiles(fullPath, files)
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith('.test.ts') &&
      !entry.name.endsWith('.test.tsx')
    ) {
      files.push(fullPath)
    }
  }

  return files
}

describe('Import restrictions', () => {
  const projectRoot = path.resolve(__dirname, '../')
  const VIEM_ADDRESS_EQUAL_IMPORT = /import\s+{[^}]*\bisAddressEqual\b[^}]*}\s+from\s+['"]viem['"]/

  it('should not import isAddressEqual from viem', async () => {
    const files = await getAllFiles(projectRoot)

    const checkFile = async (file: string) => {
      const content = await fs.readFile(file, 'utf-8')
      if (VIEM_ADDRESS_EQUAL_IMPORT.test(content)) {
        throw new Error(`Forbidden import found in file: ${file}\nPlease use isAddressEqual from "utils" instead.`)
      }
    }

    for (const file of files) {
      // eslint-disable-next-line no-await-in-loop
      await checkFile(file)
    }
  })
})
