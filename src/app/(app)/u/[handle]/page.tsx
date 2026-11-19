import { notFound } from 'next/navigation';

// The bare `/@handle` profile arrives in M6; until then it is the same "not available" page.
export default function ProfilePage() {
  notFound();
}
