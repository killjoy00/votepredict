import { pool } from '@/lib/db';

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
    'SELECT user_id, email FROM votepredict_owner_identity WHERE singleton = true LIMIT 1',
  );
  const row = result.rows[0];
  return row ? { userId: row.user_id, email: row.email } : null;
}

export async function userMatchesOwner(user: AuthUserLike): Promise<boolean> {
  const owner = await getOwnerIdentity();
  if (!owner || !user.id || !user.email) return false;
  return user.id === owner.userId && user.email.trim().toLowerCase() === owner.email.trim().toLowerCase();
}

export async function claimOwnerIdentity(userId: string, email: string): Promise<boolean> {
  const result = await pool.query(
    `INSERT INTO votepredict_owner_identity (singleton, user_id, email)
     VALUES (true, $1, $2)
     ON CONFLICT (singleton) DO NOTHING
     RETURNING user_id`,
    [userId, email.trim().toLowerCase()],
  );
  return result.rowCount === 1;
}
