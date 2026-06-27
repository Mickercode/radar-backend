import { useState } from 'react';
import { Icon } from './Icon';
import { usePwaInstall } from '../lib/usePwaInstall';

export function PwaInstall() {
  const { canInstall, install, isIOS, isStandalone, isInstalled } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isStandalone || isInstalled || dismissed) return null;

  if (isIOS) {
    return (
      <div className="pwa-install" role="alert" aria-live="polite">
        <div className="pwa-install__body">
          <Icon name="clip" size={20} />
          <span>
            Install Radar: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>
          </span>
          <button className="pwa-install__close" onClick={() => setDismissed(true)} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (canInstall) {
    return (
      <div className="pwa-install" role="alert" aria-live="polite">
        <div className="pwa-install__body">
          <Icon name="clip" size={20} />
          <span>Install Radar for the best experience</span>
          <button className="btn pwa-install__btn" onClick={install}>
            <Icon name="download" size={16} /> Install
          </button>
          <button className="pwa-install__close" onClick={() => setDismissed(true)} aria-label="Dismiss">
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
