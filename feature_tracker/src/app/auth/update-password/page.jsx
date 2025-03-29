// src/app/auth/update-password/page.jsx
import UpdatePassword from '../../../components/auth/UpdatePassword';

export const metadata = {
  title: 'Update Password',
};

export default function UpdatePasswordPage() {
  return (
    <div className="auth-container">
      <UpdatePassword />
    </div>
  );
}