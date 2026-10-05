import { useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';
import { AuthField, AuthLink, Banner, EMAIL_RE, FormHead, PrimaryButton, useAuthText } from './AuthParts';

/*
  Forgot password: asks for the email and confirms without saying whether an account
  exists. MOCK: nothing is sent until Keycloak sends the reset email.
*/
export function ForgotPasswordPage() {
  const a = useAuthText();
  const f = a.forgot;
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(null);
  const error = !email.trim() ? a.errors.emailRequired : !EMAIL_RE.test(email.trim()) ? a.errors.emailInvalid : null;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!error) setSent(email.trim());
  };

  return (
    <>
      <FormHead title={f.title} text={f.text} mock />
      {sent ? (
        <div className="flex flex-col gap-3">
          <Banner tone="success">{f.sent(sent)}</Banner>
          <Banner tone="warning">{f.mockNote}</Banner>
        </div>
      ) : (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          <AuthField label={a.email} error={touched ? error : null}>
            {({ id, invalid, describedBy, className }) => (
              <input
                id={id}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                autoComplete="username"
                autoFocus
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
                className={className}
              />
            )}
          </AuthField>
          <PrimaryButton type="submit">{f.submit}</PrimaryButton>
        </form>
      )}
      <AuthLink to="/signin" className="mt-6 flex w-fit items-center gap-1.5 text-sm">
        <LuArrowLeft size={14} className="shrink-0" aria-hidden />
        <span>{a.backToSignIn}</span>
      </AuthLink>
    </>
  );
}
