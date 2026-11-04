import assert from "node:assert/strict"
import bcrypt from "bcryptjs"

async function verifyPassword(
  input: string,
  storedHash: string | null | undefined,
  storedPlain: string | null | undefined,
): Promise<{ matches: boolean; needsUpgrade: boolean; newHash?: string }> {
  const hash = String(storedHash ?? "").trim()
  const plain = String(storedPlain ?? "").trim()

  if (hash && /^\$2[aby]\$\d{2}\$/.test(hash)) {
    const ok = await bcrypt.compare(input, hash)
    if (ok) return { matches: true, needsUpgrade: false }
  }

  const matchesPlain = (plain && input === plain) || (hash && !hash.startsWith("$2") && input === hash)
  if (matchesPlain) {
    const upgraded = await bcrypt.hash(input, 10)
    return { matches: true, needsUpgrade: true, newHash: upgraded }
  }

  return { matches: false, needsUpgrade: false }
}

async function run() {
  // 1. Valid bcrypt hash
  const realBcrypt = await bcrypt.hash("budi2026", 10)
  const res1 = await verifyPassword("budi2026", realBcrypt, null)
  assert.equal(res1.matches, true)
  assert.equal(res1.needsUpgrade, false)

  // 2. Legacy plaintext in login_password (login_password_hash is null)
  const res2 = await verifyPassword("budi2026", null, "budi2026")
  assert.equal(res2.matches, true)
  assert.equal(res2.needsUpgrade, true)
  assert.match(res2.newHash!, /^\$2[aby]\$\d{2}\$/)

  // 3. Legacy plaintext in login_password_hash (copied from previous migration)
  const res3 = await verifyPassword("budi2026", "budi2026", "budi2026")
  assert.equal(res3.matches, true)
  assert.equal(res3.needsUpgrade, true)
  assert.match(res3.newHash!, /^\$2[aby]\$\d{2}\$/)

  // 4. Wrong password
  const res4 = await verifyPassword("wrongpass", realBcrypt, "budi2026")
  assert.equal(res4.matches, false)

  console.log("✔ Customer auth logic self-check passed!")
}

run().catch((err) => {
  console.error("Self-check failed:", err)
  process.exit(1)
})
