import Csrf from './Csrf';
import { bookAction, cancelAction } from '@/app/actions/booking';

export default function SessionActions({ s, back, past }) {
  if (past) return <span className="pill">{s.my_status ? s.my_status.replace('_', ' ') : 'finished'}</span>;
  const mine = s.my_status === 'booked' || s.my_status === 'waitlist';
  const full = s.booked >= s.capacity;
  return (
    <form action={mine ? cancelAction : bookAction} className="inline">
      <Csrf />
      <input type="hidden" name="session_id" value={s.id} />
      <input type="hidden" name="back" value={back} />
      {mine ? (
        <span className="actions"><span className={`pill ${s.my_status}`}>{s.my_status === 'booked' ? 'Booked' : 'Waitlisted'}</span>
          <button className="btn btn-ghost btn-sm">{s.my_status === 'booked' ? 'Cancel' : 'Leave waitlist'}</button></span>
      ) : full ? (
        <button className="btn btn-warn btn-sm">Join waitlist</button>
      ) : (
        <button className="btn btn-sm">Book</button>
      )}
    </form>
  );
}
