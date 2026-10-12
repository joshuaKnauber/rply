export type Email = { to: string; subject: string; text: string };
export type EmailSender = (email: Email) => Promise<void>;

export function emailFromEnv(env: NodeJS.ProcessEnv): EmailSender | null {
  const apiKey = env.RPLY_RESEND_API_KEY;
  if (!apiKey) return null;
  const from = env.RPLY_EMAIL_FROM;
  if (!from) throw new Error("RPLY_EMAIL_FROM is required with RPLY_RESEND_API_KEY, e.g. rply <login@example.com>");
  return async ({ to, subject, text }) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!res.ok) throw new Error(`Sending email failed: ${res.status} ${await res.text()}`);
  };
}
