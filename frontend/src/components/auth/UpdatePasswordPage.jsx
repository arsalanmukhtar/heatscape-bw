import { useState } from 'react';
import { LuArrowLeft, LuCheck, LuMinus } from 'react-icons/lu';
import { useAuth } from '../../state/auth';
import { AuthField, AuthLink, Banner, FormHead, PasswordInput, PrimaryButton, useAuthText } from './AuthParts';

const RULES = {
  length: (p) => p.length >= 12,
  letter: (p) => /\p{L}/u.test(p),
  number: (p) => /\d/.test(p),
  differs: (p, email) => !email || !p || p.toLowerCase() !== email.toLowerCase(),
};

/*
  Update password (Keycloak's required action and reset target): new password twice,
  rules checked live. MOCK: the result is validated but not saved (passwords live in .env).
*/
export function UpdatePasswordPage() {
  const a = useAuthText();
  const u = a.update;
  const email = useAuth((s) => s.user?.email);
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState(false);
  const passed = Object.fromEntries(Object.entries(RULES).map(([k, test]) => [k, test(pw, email)]));
  const weak = Object.values(passed).includes(false);
  const errors = { pw: weak ? u.weak : null, again: again !== pw ? u.mismatch : null };

  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!errors.pw && !errors.again) setDone(true);
  };

  return (
    <>
      <FormHead title={u.title} text={u.text} mock />
      {done ? (
        <div className="flex flex-col gap-3">
          <Banner tone="success">{u.done}</Banner>
          <Banner tone="warning">{u.mockNote}</Banner>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <AuthField label={u.next} error={submitted ? errors.pw : null}>
            {(f) => <PasswordInput {...f} value={pw} onChange={setPw} autoComplete="new-password" />}
          </AuthField>
          <ul className="-mt-1 grid grid-cols-2 gap-x-3 gap-y-1" aria-label={u.next}>
            {Object.keys(RULES).map((k) => (
              <li key={k} className={`flex items-center gap-1.5 text-xs ${passed[k] && pw ? 'text-text' : 'text-muted'}`}>
                {passed[k] && pw ? <LuCheck size={12} className="shrink-0 text-success" aria-hidden /> : <LuMinus size={12} className="shrink-0" aria-hidden />}
                <span>{u.rules[k]}</span>
                <span className="sr-only">{passed[k] && pw ? '✓' : '–'}</span>
              </li>
            ))}
          </ul>
          <AuthField label={u.confirm} error={submitted ? errors.again : null}>
            {(f) => <PasswordInput {...f} value={again} onChange={setAgain} autoComplete="new-password" />}
          </AuthField>
          <PrimaryButton type="submit">{u.submit}</PrimaryButton>
        </form>
      )}
      <AuthLink to="/signin" className="mt-6 flex w-fit items-center gap-1.5 text-sm">
        <LuArrowLeft size={14} className="shrink-0" aria-hidden />
        <span>{a.backToSignIn}</span>
      </AuthLink>
    </>
  );
}
