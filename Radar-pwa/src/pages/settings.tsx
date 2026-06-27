import { Icon } from '../components/Icon';
import { usePwaInstall } from '../lib/usePwaInstall';

export function SettingsPage() {
  const { canInstall, install, isIOS, isStandalone, isInstalled } = usePwaInstall();

  return (
    <div className="container">
      <div className="page-head">
        <div className="page-kicker">Preferences</div>
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Install CTA — always visible on mobile when not already installed */}
      {!isStandalone && !isInstalled && (
        <div className="install-card">
          <div className="install-card__icon">
            <Icon name="download" size={28} />
          </div>
          <div className="install-card__text">
            <h3>Install Radar</h3>
            <p>Add to your home screen for a faster, app-like experience — works offline too.</p>
          </div>
          {isIOS ? (
            <div className="install-card__ios">
              <span>Tap</span>
              <Icon name="clip" size={16} />
              <span>Share → <strong>Add to Home Screen</strong></span>
            </div>
          ) : canInstall ? (
            <button className="install-card__btn" onClick={install}>
              <Icon name="download" size={18} />
              Install Radar
            </button>
          ) : (
            <p className="install-card__hint">
              Open your browser menu and tap <strong>Add to Home Screen</strong>
            </p>
          )}
        </div>
      )}

      <div className="empty">
        <Icon name="settings" size={48} />
        <h3>Settings</h3>
        <p>Customize your Radar experience.</p>
      </div>
    </div>
  );
}
