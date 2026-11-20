'use server';
import { requireUser } from '@/lib/auth';
import { bookSession, cancelBooking } from '@/lib/booking';
import { run, withParam } from '@/lib/action';

export async function bookAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    const id = Number(fd.get('session_id'));
    if (!Number.isInteger(id)) throw new Error('Invalid class');
    try {
      const { status } = bookSession(me.id, id);
      return withParam(back, 'msg', status === 'booked' ? 'Booked! See you there.' : 'Class is full - you are on the waitlist. We will move you in automatically if a spot opens.');
    } catch (e) {
      if (e.message === 'NO_ENTITLEMENT') return '/membership?error=' + encodeURIComponent('You need an active membership or class credits to book. Choose an option below.');
      throw e;
    }
  });
}

export async function cancelAction(fd) {
  await run(fd, async (back) => {
    const me = await requireUser();
    cancelBooking(me.id, Number(fd.get('session_id')));
    return withParam(back, 'msg', 'Booking cancelled.');
  });
}
