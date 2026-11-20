import { getCsrfToken } from '@/lib/csrf';
export default async function Csrf() {
  return <input type="hidden" name="csrf" value={await getCsrfToken()} />;
}
