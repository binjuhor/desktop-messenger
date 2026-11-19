'use strict'

// Pure URL rules shared by the main process. No Electron imports so it can be unit tested with node:test.

const START_URL = 'https://www.messenger.com/'

// Top-level navigation is allowed only to these registrable domains (and their subdomains).
// facebook.com / meta.com are needed for login, 2FA checkpoints and account center flows.
const TRUSTED_DOMAINS = ['messenger.com', 'facebook.com', 'meta.com']

// Schemes we are willing to hand to the OS. Anything else (file:, smb:, javascript:, custom
// app handlers...) is dropped to avoid launching local programs from remote content.
const EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

function parse (rawUrl) {
  try {
    return new URL(rawUrl)
  } catch {
    return null
  }
}

function hostMatches (hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`)
}

/** True when the URL is an https page on a trusted Messenger/Facebook/Meta host. */
function isTrustedUrl (rawUrl) {
  const url = parse(rawUrl)
  if (!url || url.protocol !== 'https:') return false
  return TRUSTED_DOMAINS.some((domain) => hostMatches(url.hostname, domain))
}

/** True when the given origin string (e.g. from a permission request) is trusted. */
function isTrustedOrigin (origin) {
  return typeof origin === 'string' && origin !== 'null' && isTrustedUrl(origin)
}

/** True when the URL may be passed to shell.openExternal. */
function isSafeExternalUrl (rawUrl) {
  const url = parse(rawUrl)
  return Boolean(url && EXTERNAL_PROTOCOLS.has(url.protocol))
}

// Outbound links are wrapped as https://l.messenger.com/l.php?u=<target>.
const LINK_SHIM_HOSTS = new Set(['l.messenger.com', 'l.facebook.com', 'lm.facebook.com'])

/** Returns the real target of a Messenger/Facebook link-shim URL, or null if it is not one. */
function unwrapLinkShim (rawUrl) {
  const url = parse(rawUrl)
  if (!url || url.protocol !== 'https:' || !LINK_SHIM_HOSTS.has(url.hostname)) return null
  if (url.pathname !== '/l.php') return null
  const target = url.searchParams.get('u')
  return target && isSafeExternalUrl(target) ? target : null
}

/** Parses an unread count from titles like "(3) Messenger" or "Messenger (3)". */
function unreadCountFromTitle (title) {
  const match = /\((\d+)\)/.exec(title || '')
  return match ? Number.parseInt(match[1], 10) : 0
}

module.exports = {
  START_URL,
  TRUSTED_DOMAINS,
  isTrustedUrl,
  isTrustedOrigin,
  isSafeExternalUrl,
  unwrapLinkShim,
  unreadCountFromTitle
}
