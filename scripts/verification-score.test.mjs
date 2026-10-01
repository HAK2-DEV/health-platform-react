import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchVerificationAward } from '../src/lib/verificationScore.js'

function clientFor(result) {
  return { from(table) {
    assert.equal(table, 'score_ledgers')
    return { select(columns) {
      assert.equal(columns, 'point')
      return { eq(key, id) {
        assert.equal(key, 'verification_id')
        assert.equal(id, 'saved-verification')
        return { maybeSingle: async () => {
          if (result instanceof Error) throw result
          return result
        } }
      } }
    } }
  } }
}

for (const [name, response, expected] of [
  ['uses persisted award instead of mission maximum', { data: { point: 10 }, error: null }, 10],
  ['keeps confirmed zero', { data: { point: 0 }, error: null }, 0],
  ['no ledger is zero after a successful lookup', { data: null, error: null }, 0],
  ['API failure is unknown, not zero', { data: null, error: { message: 'denied' } }, null],
  ['network failure does not undo successful submission', new Error('offline'), null],
]) {
  test(name, async () => {
    assert.equal(await fetchVerificationAward(clientFor(response), 'saved-verification'), expected)
  })
}
