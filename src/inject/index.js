for (const method of ['pushState', 'replaceState']) {
  const original = history[method]
  history[method] = function (...args) {
    const previous = location.href
    const result = original.apply(this, args)
    if (location.href !== previous)
      window.dispatchEvent(new Event('historyChange'))
    return result
  }
}
