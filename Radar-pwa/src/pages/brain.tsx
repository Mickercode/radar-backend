import { Icon } from '../components/Icon';

export function BrainPage() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-kicker">Knowledge Graph</div>
        <h1 className="page-title">Brain</h1>
      </div>
      <div className="empty">
        <Icon name="brain" size={48} />
        <h3>Your second brain</h3>
        <p>Insights, connections, and spaced repetition.</p>
      </div>
    </div>
  );
}
