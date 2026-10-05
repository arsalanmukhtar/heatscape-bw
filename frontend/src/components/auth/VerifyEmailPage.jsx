import { useEffect, useState } from 'react';
import { LuArrowLeft, LuMailCheck } from 'react-icons/lu';
import { useAuth } from '../../state/auth';
import { AuthLink, Banner, FormHead, SecondaryButton, useAuthText } from './AuthParts';

const COOLDOWN = 30;

/*
  Email verification notice (Keycloak's verify-email step): where the link went and a
  resend button with a cooldown. MOCK: nothing is sent.
*/
export function VerifyEmailPage() {
  const a = useAuthText();
  const v = a.verify;
  const email = useAuth((s) => s.user?.email);
  const [wait, setWait] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (!wait) return;
    const id = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  return (
    <>
      <div className="mb-5 grid size-11 place-items-center border border-border-strong bg-surface-raised text-accent" aria-hidden>
        <LuMailCheck size={20} />
      </div>
      <FormHead title={v.title} text={v.text(email ?? v.someone)} mock />
      <div className="flex flex-col gap-3">
        {resent && <Banner tone="success">{v.resent}</Banner>}
        <SecondaryButton
          type="button"
          disabled={wait > 0}
          onClick={() => {
            setResent(true);
            setWait(COOLDOWN);
          }}
        >
          {wait > 0 ? v.wait(wait) : v.resend}
        </SecondaryButton>
        <Banner tone="warning">{v.mockNote}</Banner>
      </div>
      <AuthLink to="/signin" className="mt-6 flex w-fit items-center gap-1.5 text-sm">
        <LuArrowLeft size={14} className="shrink-0" aria-hidden />
        <span>{a.backToSignIn}</span>
      </AuthLink>
    </>
  );
}
