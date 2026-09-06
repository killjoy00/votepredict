import { redirect } from 'next/navigation';
import { auth } from './server';

export async function requireOwner() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user) redirect('/auth/sign-in');

  const ownerEmail = process.env.VOTEPREDICT_OWNER_EMAIL?.trim().toLowerCase();
  const userEmail = user.email?.trim().toLowerCase();

  if (!ownerEmail || !userEmail || ownerEmail !== userEmail) {
    redirect('/unauthorized');
  }

  return user;
}
