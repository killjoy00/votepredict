import { pool } from '@/lib/db';

const OWNER_ROLE = 'votepredict-owner';
const OWNER_CLAIM_LOCK = 'votepredict-owner-claim';

type AuthUserLike = {
  id?: string | null;
  email?: string | null;
};

export type OwnerIdentity = {
  userId: string;
  email: string;
};

export async function getOwnerIdentity(): Promise<OwnerIdentity | null> {
  const result = await pool.query<{ user_id: string; email: string }>(
    `SELECT id::text AS user_id, email
     FROM neon_auth."user"
     WHERE role = $1
     ORDER BY "createdAt" ASC
     LIMIT 2`,
    [OWNER_ROLE],
  );
  if (result.rowCount && result.rowCount > 1) {
    throw new Error('Multiple VotePredict owner accounts are configured.');
  }
  const row = result.rows[0];
  return row ? { userId: row.user_id, email: row.email } : null;
}

export async function userMatchesOwner(user: AuthUserLike): Promise<boolean> {
  const owner = await getOwnerIdentity();
  if (!owner || !user.id || !user.email) return false;
  return user.id === owner.userId && user.email.trim().toLowerCase() === owner.email.trim().toLowerCase();
}

export async function claimOwnerIdentity(userId: string, email: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [OWNER_CLAIM_LOCK]);

    const existing = await client.query<{ id: string }>(
      'SELECT id::text AS id FROM neon_auth."user" WHERE role = $1 LIMIT 1',
      [OWNER_ROLE],
    );
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return false;
    }

    const updated = await client.query(
      `UPDATE neon_auth."user"
       SET role = $1, "updatedAt" = now()
       WHERE id::text = $2 AND lower(email) = $3
       RETURNING id`,
      [OWNER_ROLE, userId, email.trim().toLowerCase()],
    );
    if (updated.rowCount !== 1) {
      await client.query('ROLLBACK');
      return false;
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
