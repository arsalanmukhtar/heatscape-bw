import { useEffect, useState } from 'react';
import { authText } from '../../i18n';
import { useSession } from '../../state/auth';
import { AccountPage } from './AccountPage';
import { AuthLayout } from './AuthParts';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { SignInPage } from './SignInPage';
import { UpdatePasswordPage } from './UpdatePasswordPage';
import { VerifyEmailPage } from './VerifyEmailPage';

// Sign-in pages share the split layout; the account settings have their own shell.
const PAGES = {
  '/signin': { Page: SignInPage, title: (a) => a.signIn.title },
  '/signin/forgot': { Page: ForgotPasswordPage, title: (a) => a.forgot.title },
  '/signin/update-password': { Page: UpdatePasswordPage, title: (a) => a.update.title },
  '/signin/verify-email': { Page: VerifyEmailPage, title: (a) => a.verify.title },
};

const currentPath = () => location.pathname.replace(/\/+$/, '') || '/';

/*
  Sign-in and account (/signin…, /account): standalone pages, later ported to a Keycloak
  theme (Keycloakify); the session itself lives in the middleware.
*/
export default function AuthApp() {
  const [path, setPath] = useState(currentPath);
  const { lang } = useSession();
  const a = authText[lang];

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const account = path === '/account';
  const { Page, title } = PAGES[path] ?? PAGES['/signin'];

  useEffect(() => {
    document.title = `${account ? a.account.title : title(a)} · ${a.brand} ${a.region}`;
    document.documentElement.lang = lang;
  }, [account, title, a, lang]);

  if (account) return <AccountPage />;
  return (
    <AuthLayout>
      <Page key={path} />
    </AuthLayout>
  );
}
