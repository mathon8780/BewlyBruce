import browser from 'webextension-polyfill'

interface StorageWrite {
  key: string
  raw: string | null
  patch?: Record<string, unknown>
  replaceIf?: { raw: unknown }
}

export function setupStorageMessages() {
  let writes = Promise.resolve()
  browser.runtime.onMessage.addListener((message: unknown) => {
    const update = (message as { storageWrite?: StorageWrite })?.storageWrite
    if (!update)
      return
    const result = writes.then(async () => {
      const { key, raw, patch, replaceIf } = update
      if (raw === null) {
        await browser.storage.local.remove(key)
      }
      else {
        const stored = (await browser.storage.local.get(key))[key]
        // 仅当存储仍是读取时发现的损坏值，才用完整快照替换它。
        const needsRecovery = replaceIf && JSON.stringify(stored) === JSON.stringify(replaceIf.raw)
        const value = patch && !needsRecovery
          ? JSON.stringify({ ...(stored ? JSON.parse(stored as string) : {}), ...patch })
          : raw
        await browser.storage.local.set({ [key]: value })
      }
    })
    writes = result.catch(console.error)
    return result
  })
}
