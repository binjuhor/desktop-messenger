'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const {
  isTrustedUrl,
  isTrustedOrigin,
  isSafeExternalUrl,
  unwrapLinkShim,
  unreadCountFromTitle
} = require('../src/url-policy')

test('trusts https Messenger, Facebook and Meta hosts', () => {
  for (const url of [
    'https://www.messenger.com/t/123',
    'https://messenger.com/',
    'https://www.facebook.com/checkpoint/',
    'https://accountscenter.meta.com/'
  ]) assert.equal(isTrustedUrl(url), true, url)
})

test('rejects lookalike, non-https and malformed URLs', () => {
  for (const url of [
    'http://www.messenger.com/',
    'https://evilmessenger.com/',
    'https://messenger.com.evil.io/',
    'https://evil.io/?u=https://messenger.com',
    'https://messenger.com@evil.io/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'not a url',
    ''
  ]) assert.equal(isTrustedUrl(url), false, url)
})

test('trusts only real origins', () => {
  assert.equal(isTrustedOrigin('https://www.messenger.com'), true)
  assert.equal(isTrustedOrigin('null'), false)
  assert.equal(isTrustedOrigin(undefined), false)
})

test('only web and mail links may be opened externally', () => {
  assert.equal(isSafeExternalUrl('https://example.com'), true)
  assert.equal(isSafeExternalUrl('mailto:a@b.co'), true)
  for (const url of ['file:///Applications/Calculator.app', 'smb://host/share', 'ms-msdt:/id', 'javascript:1', 'x'])
    assert.equal(isSafeExternalUrl(url), false, url)
})

test('parses unread counts from the page title', () => {
  assert.equal(unreadCountFromTitle('(3) Messenger'), 3)
  assert.equal(unreadCountFromTitle('Messenger (12)'), 12)
  assert.equal(unreadCountFromTitle('Messenger'), 0)
  assert.equal(unreadCountFromTitle(undefined), 0)
})

test('unwraps Messenger link shims to their real target', () => {
  const target = 'https://example.com/a?b=1'
  assert.equal(unwrapLinkShim(`https://l.messenger.com/l.php?u=${encodeURIComponent(target)}&h=x`), target)
  assert.equal(unwrapLinkShim(`https://l.facebook.com/l.php?u=${encodeURIComponent(target)}`), target)
  assert.equal(unwrapLinkShim('https://l.messenger.com/l.php?u=file%3A%2F%2F%2Fetc%2Fpasswd'), null)
  assert.equal(unwrapLinkShim('https://www.messenger.com/l.php?u=https%3A%2F%2Fexample.com'), null)
  assert.equal(unwrapLinkShim('https://l.messenger.com/other?u=https%3A%2F%2Fexample.com'), null)
})
