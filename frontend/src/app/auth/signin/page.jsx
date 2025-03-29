import SignIn from '../../../components/auth/SignIn';

export const metadata = {
  title: 'Sign In',
};

export default function SignInPage() {
  return (
    <div className="auth-container">
      <SignIn />
    </div>
  );
}
