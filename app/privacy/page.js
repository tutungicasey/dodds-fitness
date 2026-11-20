export const metadata = { title: 'Privacy notice' };
export default function Privacy() {
  return (
    <div className="card" style={{ maxWidth: 780 }}>
      <h1>Privacy notice</h1>
      <p className="muted small">DRAFT for the v1 prototype - to be reviewed before launch. Dodds Fitness, Melbourne VIC. Contact: privacy@doddsfitness.example (placeholder).</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, password (stored only as a one-way bcrypt hash), and optional phone, date of birth, emergency contact, goals and injuries.</li>
        <li>Class bookings and attendance.</li>
        <li>Your diary: workouts, food entries, body measurements and notes you choose to record. Some of this is health information, which is sensitive information under the Privacy Act 1988 (Cth); we collect it only with your consent and only to provide the service.</li>
        <li>Payment records (plan, amount, date). Card details are handled entirely by our payment provider (Stripe) and are never stored by Dodds Fitness.</li>
      </ul>
      <h2>Who can see it</h2>
      <ul>
        <li>You can see all of your own data. Other members cannot see any of it.</li>
        <li>Your assigned trainer can see your profile, diary and progress to coach you. Trainers can write notes; some are shared with you.</li>
        <li>Gym administrators can see member lists, bookings and payments to run the gym. Administrator actions are recorded in an audit log.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li><strong>Access/export:</strong> download a copy of your data any time from your Profile page.</li>
        <li><strong>Correction:</strong> edit your profile and diary entries yourself.</li>
        <li><strong>Deletion:</strong> delete your account from your Profile page. Your personal data is removed; anonymised payment records are kept as required for tax purposes.</li>
      </ul>
      <h2>Security</h2>
      <p>Passwords are hashed, sessions use secure HttpOnly cookies, all forms are protected against cross-site request forgery, login attempts are rate limited, and the site should be served only over HTTPS in production.</p>
      <h2>Complaints</h2>
      <p>Contact us first. If you are not satisfied you can contact the Office of the Australian Information Commissioner (oaic.gov.au).</p>
    </div>
  );
}
