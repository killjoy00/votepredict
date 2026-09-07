import { redirect } from 'next/navigation';
import { auth } from './server';
import { userMatchesOwner } from './owner';

export async function requireOwner() {
  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user) redirect('/auth/sign-in');

  if (!(await userMatchesOwner(user))) {
    redirect('/unauthorized');
  }

  return user;
}
