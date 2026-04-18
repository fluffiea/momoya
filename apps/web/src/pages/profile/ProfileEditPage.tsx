import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/useAuth';
import ProfileEditor from './ProfileEditor';

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  if (!user) return null;

  const editorKey = `${user.profile.displayName}|${user.profile.bio}|${user.profile.avatarUrl}`;

  return (
    <div className="home-romance-bg">
      <div className="mx-auto w-[92%] max-w-md px-0 pb-safe-page pt-4 sm:pt-6">
        <header className="mb-5 flex items-center gap-2 border-b border-border-sweet/30 pb-3">
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg text-neutral-500 transition hover:bg-white/80 hover:text-neutral-800"
            aria-label="返回"
          >
            ‹
          </button>
          <h1 className="font-display text-lg font-bold text-brown-title sm:text-xl">编辑资料</h1>
        </header>

        <ProfileEditor key={editorKey} user={user} refresh={refresh} onDone={() => navigate('/profile')} />
      </div>
    </div>
  );
}
