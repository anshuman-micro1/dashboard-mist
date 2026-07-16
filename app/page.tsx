import { redirect } from 'next/navigation';
import { getSessionUserFromCookies } from '@/lib/auth';

export default async function HomePage() {
  const session = await getSessionUserFromCookies();
  redirect(session ? '/dashboard' : '/login');
}
