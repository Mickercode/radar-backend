import { Icon } from '../components/Icon';

export function FeedPage() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-kicker">Curated for you</div>
        <h1 className="page-title">Feed</h1>
      </div>
      <div className="empty">
        <Icon name="feed" size={48} />
        <h3>Your feed is loading</h3>
        <p>Discover content tailored to your interests.</p>
      </div>
    </div>
  );
}
