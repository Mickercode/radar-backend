import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container">
      <div className="empty" style={{ minHeight: '60vh' }}>
        <h2>404</h2>
        <p>This page doesn't exist.</p>
        <Link to="/" className="btn btn--primary">Go Home</Link>
      </div>
    </div>
  );
}
