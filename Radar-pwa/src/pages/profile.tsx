import { Icon } from '../components/Icon';

export function ProfilePage() {
  return (
    <div className="container">
      <div className="page-head">
        <div className="page-kicker">Account</div>
        <h1 className="page-title">Profile</h1>
      </div>
      <div className="empty">
        <Icon name="profile" size={48} />
        <h3>Your profile</h3>
        <p>Manage your account and preferences.</p>
      </div>
    </div>
  );
}
