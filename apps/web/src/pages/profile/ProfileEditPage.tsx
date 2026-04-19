import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import SecondaryPageHeader from '@/components/ui/SecondaryPageHeader';
import ProfileEditor from './ProfileEditor';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  if (!user) return null;

  const editorKey = `${user.profile.displayName}|${user.profile.bio}|${user.profile.avatarUrl}`;

  return (
    <div className="home-romance-bg flex min-h-full flex-col">
      <SecondaryPageHeader title="编辑资料" backTo="/profile" />

      <div className="mx-auto w-[92%] max-w-md flex-1 px-0 pb-safe-page pt-4 sm:pt-5">
        <ProfileEditor key={editorKey} user={user} refresh={refresh} onDone={() => navigate('/profile')} />
      </div>
    </div>
  );
}
