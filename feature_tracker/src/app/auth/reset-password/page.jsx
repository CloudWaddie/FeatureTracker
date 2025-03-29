// src/app/auth/reset-password/page.jsx
import ResetPassword from '../../../components/auth/ResetPassword';

export const metadata = {
  title: 'Reset Password',
};

export default function ResetPasswordPage() {
  return (
    <div className="auth-container">
      <ResetPassword />
    </div>
  );
}