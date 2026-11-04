import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { sha256, verifyHashHelper } from './avatar-qa-hash.mjs'

verifyHashHelper()
// Reproduce the A3 typo in an isolated module: preflight must stop before network.
const source = await readFile(new URL('./avatar-qa-hash.mjs', import.meta.url), 'utf8')
const brokenSource = source.replace("createHash('sha256')", "createHash('sha356')")
assert.notEqual(brokenSource, source)
const broken = await import(`data:text/javascript;base64,${Buffer.from(brokenSource).toString('base64')}`)
assert.throws(() => broken.verifyHashHelper())
assert.equal(sha256(Buffer.from([0, 1, 2, 255])).length, 64)
console.log('PASS SHA-256 known answers, byte input, distinct content and preflight rejection of the A3 typo; no network')
