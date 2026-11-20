export default function Flash({ sp }) {
  if (!sp) return null;
  return (
    <>
      {sp.msg && <div className="flash ok" role="status">{String(sp.msg)}</div>}
      {sp.error && <div className="flash err" role="alert">{String(sp.error)}</div>}
    </>
  );
}
