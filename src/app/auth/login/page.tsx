import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-white/70">Sign in to your plant journal</p>
          </div>
          <AuthForm mode="login" />
        </div>
      </div>
    </div>
  );
}
