// A successful submission must stay successful even if the score read fails.
// null means unknown, never an estimated award or a confirmed zero.
export async function fetchVerificationAward(client, verificationId) {
  try {
    const { data, error } = await client.from('score_ledgers')
      .select('point').eq('verification_id', verificationId).maybeSingle()
    if (error) return null
    return data?.point ?? 0
  } catch {
    return null
  }
}
