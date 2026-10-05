import { useState } from 'react';
import { LuBuilding2 } from 'react-icons/lu';
import { isAdmin, safeNext, useAuth } from '../../state/auth';
import { Check } from '../controls';
import { AuthField, AuthLink, Banner, EMAIL_RE, FormHead, PasswordInput, PrimaryButton, SecondaryButton, useAuthText } from './AuthParts';

const params = () => new URLSearchParams(location.search);

/*
  Sign in with email and password (middleware session). ?next= returns there after
  sign-in; next=/admin needs the Admin role (the gateway enforces it, this page explains
  it). ?denied=admin: the gateway sent a signed-in user without the role here.
*/
export function SignInPage() {
  const a = useAuthText();
  const s = a.signIn;
  const { status, user, signIn, signOut } = useAuth();
  const next = safeNext(params().get('next'));
  const forAdmin = next === '/admin' || next.startsWith('/admin/');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null); // { kind, user?, minutes? }
  const [sso, setSso] = useState(false);

  const errors = {
    email: !email.trim() ? a.errors.emailRequired : !EMAIL_RE.test(email.trim()) ? a.errors.emailInvalid : null,
    password: !password ? a.errors.passwordRequired : null,
  };
  const shown = (k) => ((submitted || touched[k]) && errors[k]) || null;

  // Signed in already but sent here without the admin role, or a plain visit.
  const denied = status === 'in' && forAdmin && !isAdmin(user);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setSso(false);
    if (errors.email || errors.password) return;
    setBusy(true);
    setFailure(null);
    try {
      const u = await signIn(email.trim(), password, remember);
      if (forAdmin && !isAdmin(u)) {
        setFailure({ kind: 'denied', user: u });
        setPassword('');
      } else {
        location.assign(next);
        return;
      }
    } catch (err) {
      if (err.status === 401 || err.status === 400) setFailure({ kind: 'invalid' });
      else if (err.status === 429) setFailure({ kind: 'tooMany', minutes: Math.max(1, Math.ceil((err.retryAfter ?? 900) / 60)) });
      else setFailure({ kind: 'unreachable' });
    }
    setBusy(false);
  };

  const failureText =
    failure?.kind === 'invalid'
      ? a.errors.invalid
      : failure?.kind === 'tooMany'
        ? a.errors.tooMany(failure.minutes)
        : failure?.kind === 'unreachable'
          ? a.errors.unreachable
          : failure?.kind === 'denied'
            ? s.denied(failure.user.email)
            : null;

  if (status === 'in' && !denied && !failure) {
    return (
      <>
        <FormHead title={s.title} />
        <Banner tone="info" className="mb-5">
          {s.signedInAs(user.name)}
        </Banner>
        <div className="flex flex-col gap-3">
          <PrimaryButton type="button" onClick={() => location.assign(next)}>
            {s.continue}
          </PrimaryButton>
          <SecondaryButton type="button" onClick={signOut}>
            {s.switch}
          </SecondaryButton>
        </div>
      </>
    );
  }

  return (
    <>
      <FormHead title={s.title} text={forAdmin ? s.adminOnly : s.text} />
      {(failureText || denied) && (
        <Banner tone="error" className="mb-5">
          {failureText ?? s.denied(user.email)}
        </Banner>
      )}
      {sso && (
        <Banner tone="info" className="mb-5">
          {s.ssoNote}
        </Banner>
      )}
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <AuthField label={a.email} error={shown('email')}>
          {({ id, invalid, describedBy, className }) => (
            <input
              id={id}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((x) => ({ ...x, email: true }))}
              autoComplete="username"
              autoFocus
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
              className={className}
            />
          )}
        </AuthField>
        <AuthField label={a.password} error={shown('password')}>
          {(f) => <PasswordInput {...f} value={password} onChange={setPassword} onBlur={() => setTouched((x) => ({ ...x, password: true }))} />}
        </AuthField>
        <div className="flex items-center justify-between gap-3">
          <Check checked={remember} onChange={setRemember} label={s.remember} hint={s.rememberHint} />
          <AuthLink to="/signin/forgot" className="text-xs">
            {s.forgot}
          </AuthLink>
        </div>
        <PrimaryButton type="submit" disabled={busy} busy={busy}>
          {busy ? s.busy : s.submit}
        </PrimaryButton>
      </form>
      <div className="my-5 flex items-center gap-3 text-2xs uppercase tracking-[var(--tracking-caps)] text-muted" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        <span>{s.or}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <SecondaryButton type="button" onClick={() => setSso(true)} icon={<LuBuilding2 size={15} className="shrink-0 text-muted" aria-hidden />}>
        {s.sso}
      </SecondaryButton>
    </>
  );
}
