export default function UnauthorizedPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-mark">VP</div>
        <p className="eyebrow">Private workspace</p>
        <h1>This account is not authorized.</h1>
        <p className="muted">VotePredict V2 currently accepts only the configured owner account.</p>
      </section>
    </main>
  );
}
