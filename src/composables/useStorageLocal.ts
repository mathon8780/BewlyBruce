import type { MaybeRef, RemovableRef, UseStorageAsyncOptions } from '@vueuse/core'
import { StorageSerializers } from '@vueuse/core'
import type { Ref } from 'vue'
import { readonly, ref, shallowRef, toRaw, unref, watch } from 'vue'
import browser from 'webextension-polyfill'

interface LocalStorageOptions<T> extends UseStorageAsyncOptions<T> {
  debounce?: number
  migrate?: (raw: string) => readonly string[]
}

export type ReadyStorageRef<T> = RemovableRef<T> & {
  ready: Promise<void>
  hydrated: Readonly<Ref<boolean>>
  flush: (options?: { recoverInvalid?: boolean }) => Promise<void>
}

export class InvalidStoredValueError extends Error {}

export function useStorageLocal<T>(
  key: string,
  initialValue: MaybeRef<T>,
  options: LocalStorageOptions<T> = {},
): ReadyStorageRef<T> {
  const defaults = structuredClone(toRaw(unref(initialValue)))
  const initial = structuredClone(defaults)
  const data = (options.shallow ? shallowRef(initial) : ref(initial)) as unknown as ReadyStorageRef<T>
  const serializer
    = options.serializer
      ?? (typeof defaults === 'object'
        ? StorageSerializers.object
        : StorageSerializers[typeof defaults as 'string' | 'number' | 'boolean'])
  const object = defaults !== null && typeof defaults === 'object' && !Array.isArray(defaults)
  const onError = options.onError ?? console.error
  const dirty = new Map<string, number>()
  const snapshot = () => structuredClone(toRaw(data.value))
  let previous = snapshot()
  let revision = 0
  let applying = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let retryDelay = 1000
  const hydrated = shallowRef(false)
  data.hydrated = readonly(hydrated)
  let pendingChange: { value: unknown } | undefined
  let invalidRecord: { raw: unknown } | undefined
  let writes = Promise.resolve()
  let updates = Promise.resolve()

  const read = async (raw: unknown): Promise<T> => {
    const value = raw == null ? structuredClone(defaults) : await serializer.read(raw as string)
    return options.mergeDefaults && object ? { ...defaults, ...value } : value
  }
  async function readPersisted(raw: unknown) {
    try {
      return { value: await read(raw), invalid: undefined }
    }
    catch (error) {
      if (!(error instanceof SyntaxError || error instanceof InvalidStoredValueError))
        throw error
      onError(error)
      return { value: structuredClone(defaults), invalid: { raw } }
    }
  }

  function apply(value: T) {
    applying = true
    data.value = value
    previous = snapshot()
    applying = false
  }
  function applyIncoming(incoming: T) {
    if (object) {
      for (const field of dirty.keys()) (incoming as any)[field] = (previous as any)[field]
      apply(incoming)
    }
    else if (!dirty.size) {
      apply(incoming)
    }
  }

  async function hydrate() {
    if (hydrated.value)
      return
    clearTimeout(retryTimer)
    try {
      const stored = (await browser.storage.local.get(key))[key]
      let change = pendingChange
      let raw = change ? change.value : stored
      let incoming = await readPersisted(raw)
      // 自定义反序列化尚未完成时，仍可能收到更新的存储事件。
      while (pendingChange !== change) {
        change = pendingChange
        raw = change?.value
        incoming = await readPersisted(raw)
      }
      const migration = raw == null || incoming.invalid ? [] : options.migrate?.(raw as string) ?? []
      invalidRecord = incoming.invalid
      applyIncoming(incoming.value)
      pendingChange = undefined
      const fields = raw == null && options.writeDefaults !== false
        ? (object ? Object.keys(data.value as object) : ['value'])
        : migration
      for (const field of fields)
        dirty.set(field, ++revision)
      hydrated.value = true
    }
    catch (error) {
      retryTimer = setTimeout(() => {
        void data.flush().catch(onError)
      }, retryDelay)
      retryDelay = Math.min(retryDelay * 2, 30_000)
      throw error
    }
  }

  data.flush = ({ recoverInvalid = false } = {}) => {
    clearTimeout(timer)
    timer = undefined
    const result = writes.then(async () => {
      await hydrate()
      const replaceIf = invalidRecord
      if (!dirty.size && !(recoverInvalid && replaceIf))
        return
      const fields = new Map(dirty)
      const value = snapshot()
      const raw = value == null ? null : await serializer.write(value)
      const serialized = object && raw !== null ? JSON.parse(raw) : undefined
      const patch = serialized && Object.fromEntries([...fields.keys()].map(field => [field, serialized[field]]))
      await browser.runtime.sendMessage({ storageWrite: { key, raw, patch, replaceIf } })
      if (invalidRecord === replaceIf)
        invalidRecord = undefined
      for (const [field, version] of fields) {
        if (dirty.get(field) === version)
          dirty.delete(field)
      }
    })
    writes = result.catch(() => {})
    return result
  }
  watch(
    data,
    () => {
      if (applying)
        return
      const value = snapshot()
      for (const field of object ? Object.keys(value as object) : ['value']) {
        if (
          !object
          || ((value as any)[field] !== (previous as any)[field]
            && JSON.stringify((value as any)[field]) !== JSON.stringify((previous as any)[field]))
        ) {
          dirty.set(field, ++revision)
        }
      }
      previous = value
      clearTimeout(timer)
      if (options.debounce) {
        timer = setTimeout(() => {
          void data.flush().catch(onError)
        }, options.debounce)
      }
      else {
        void data.flush().catch(onError)
      }
    },
    { deep: options.deep ?? true, flush: 'sync' },
  )
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[key])
      return
    const value = changes[key].newValue
    if (!hydrated.value) {
      pendingChange = { value }
      return
    }
    updates = updates.then(async () => {
      const incoming = await readPersisted(value)
      invalidRecord = incoming.invalid
      if (!incoming.invalid)
        applyIncoming(incoming.value)
    }).catch(onError)
  })
  data.ready = data.flush().catch(onError)
  window.addEventListener('pagehide', () => {
    if (timer)
      void data.flush().catch(onError)
  })
  return data
}
