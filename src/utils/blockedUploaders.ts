export const BLOCKED_UPLOADERS_KEY = 'blockedUploaders'

export interface BlockedUploader {
  name: string
  avatar?: string
}

export type BlockedUploaders = Readonly<Record<string, BlockedUploader>>

export interface BlockedUploaderUpdate {
  mid: string
  name: string | null
  avatar?: string
}

export function normalizeUploaderMid(mid: unknown): string | undefined {
  if (typeof mid === 'number' && Number.isSafeInteger(mid) && mid > 0)
    return String(mid)
  if (typeof mid === 'string' && /^[1-9]\d*$/.test(mid))
    return mid
}

export function normalizeUploaderAvatar(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value)
    return
  try {
    const url = new URL(value.startsWith('//') ? `https:${value}` : value)
    if ((url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password) {
      url.protocol = 'https:'
      return url.href
    }
  }
  catch {
    return undefined
  }
}

export function readBlockedUploaders(value: unknown): BlockedUploaders {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  const uploaders: Record<string, BlockedUploader> = {}
  for (const [mid, entry] of Object.entries(value)) {
    if (!normalizeUploaderMid(mid))
      continue
    if (typeof entry === 'string') {
      uploaders[mid] = { name: entry }
    }
    else if (entry && typeof entry.name === 'string') {
      const avatar = normalizeUploaderAvatar(entry.avatar)
      uploaders[mid] = { name: entry.name, ...(avatar && { avatar }) }
    }
  }
  return uploaders
}
