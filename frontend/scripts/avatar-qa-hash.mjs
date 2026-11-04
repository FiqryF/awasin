import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'

// Keep the algorithm independent of account names and run before any cloud call.
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

export function verifyHashHelper() {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  assert.notEqual(sha256('image A'), sha256('image B'))
}
