import { redirect } from 'next/navigation';

export default function CareCalendarPage() {
  redirect('/care?view=calendar');
}
