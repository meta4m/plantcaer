import { AuthForm } from '@/components/auth-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass-card rounded-2xl p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-white">Create account</h1>
            <p className="mt-2 text-sm text-white/70">Start tracking your plants</p>
          </div>
          <AuthForm mode="signup" />
        </div>
      </div>
    </div>
  );
}
