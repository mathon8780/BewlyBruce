const chargeLabel = /充[电電](?:[会會][员員])?[专專][属屬享]/
const limitedFreeLabel = /限免|(?:限[时時]|[暂暫][时時])(?:免[费費]|[开開]放免[费費])/

export function hasChargeLabel(labels: string[]) {
  return labels.some(label => chargeLabel.test(label)) && !labels.some(label => limitedFreeLabel.test(label))
}

function fields(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function readLabel(value: unknown) {
  if (typeof value === 'string')
    return value
  const badge = fields(value)
  const label = badge.text ?? badge.content ?? badge.desc
  return typeof label === 'string' ? label : ''
}

export function isChargeExclusive(item: unknown) {
  const video = fields(item)
  const labels = [
    video.badge,
    video.badge_info,
    video.cover_badge,
    video.rcmd_reason,
    video.bottom_rcmd_reason,
    ...(Array.isArray(video.badges) ? video.badges : []),
  ].map(readLabel)
  const level = fields(video.charging_pay).level
  const isExclusive = video.is_upower_exclusive === true || video.is_upower_exclusive === 1
    || (typeof level === 'number' && level > 0)
  return (isExclusive || labels.some(label => chargeLabel.test(label)))
    && !labels.some(label => limitedFreeLabel.test(label))
}
