import { Icon } from '../components/Icon';

export function CapturePage() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-kicker">Save & Summarize</div>
        <h1 className="page-title">Capture</h1>
      </div>
      <div className="empty">
        <Icon name="capture" size={48} />
        <h3>Capture a link</h3>
        <p>Paste a URL to get an AI-powered insight preview.</p>
      </div>
    </div>
  );
}
