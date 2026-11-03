// Inbound armor must be the exact string the mailbox stored: its keccak256 is
// the `gossip_delivery_ack` hash. A trimmed copy of an armor that ends with a
// newline (voice offers do) never matched, so the mailbox replayed it forever.
import assert from 'node:assert/strict'
import { keccak256, toUtf8Bytes } from 'ethers'
import { findInboundArmor } from '../src/worker/gossip-core.ts'

const ARMOR = '-----BEGIN PGP MESSAGE-----\n\nwcBMA1234\n=abcd\n-----END PGP MESSAGE-----\n'
const hash = (s: string) => keccak256(toUtf8Bytes(s))

// SI frame: `{ data: <stored armor> }` — returned untouched, so the hashes match.
const fromFrame = findInboundArmor({ data: ARMOR })
assert.equal(fromFrame, ARMOR)
assert.equal(hash(fromFrame), hash(ARMOR))
assert.notEqual(hash(ARMOR.trim()), hash(ARMOR), 'sanity: trimming changes the hash')

// Same through a JSON string wrapper and a nested envelope.
assert.equal(findInboundArmor(JSON.stringify({ data: ARMOR })), ARMOR)
assert.equal(findInboundArmor({ message: { data: ARMOR } }), ARMOR)

// An armor without a trailing newline is unchanged too.
const tight = ARMOR.trimEnd()
assert.equal(findInboundArmor({ data: tight }), tight)

// Non-armor input still yields nothing.
assert.equal(findInboundArmor({ data: 'hello' }), '')
assert.equal(findInboundArmor(42), '')

console.log('inbound armor tests passed')
