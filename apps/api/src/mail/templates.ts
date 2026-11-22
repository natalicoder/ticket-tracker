interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(opts: { preheader: string; heading: string; intro: string; button: string; link: string; footer: string }): string {
  const link = escapeHtml(opts.link);
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1c22;">
<span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f6;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;border:1px solid #e4e4e8;">
<tr><td style="padding:28px 32px 0 32px;">
<div style="font-size:15px;font-weight:700;letter-spacing:-0.01em;"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#5b5bd6;margin-right:8px;"></span>Ticketing</div>
</td></tr>
<tr><td style="padding:24px 32px 8px 32px;">
<h1 style="margin:0 0 12px 0;font-size:20px;line-height:1.3;font-weight:650;">${escapeHtml(opts.heading)}</h1>
<p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#4a4a55;">${escapeHtml(opts.intro)}</p>
<a href="${link}" style="display:inline-block;background:#5b5bd6;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 20px;border-radius:8px;">${escapeHtml(opts.button)}</a>
</td></tr>
<tr><td style="padding:24px 32px 28px 32px;">
<p style="margin:0 0 6px 0;font-size:12px;color:#6b6b76;">Or paste this link into your browser:</p>
<p style="margin:0;font-size:12px;word-break:break-all;"><a href="${link}" style="color:#5b5bd6;">${link}</a></p>
<p style="margin:20px 0 0 0;font-size:12px;color:#8a8a94;">${escapeHtml(opts.footer)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function verificationEmail(link: string): EmailContent {
  return {
    subject: 'Verify your email for Ticketing',
    text: [
      'Welcome to Ticketing!',
      '',
      'Confirm your email address to activate your account:',
      link,
      '',
      'The link expires in 24 hours and can be used once.',
      "If you didn't sign up, you can ignore this email.",
    ].join('\n'),
    html: layout({
      preheader: 'Confirm your email to activate your account.',
      heading: 'Verify your email',
      intro: 'Confirm your email address to activate your Ticketing account.',
      button: 'Verify email',
      link,
      footer: "The link expires in 24 hours and can be used once. If you didn't sign up, ignore this email.",
    }),
  };
}

export function resetPasswordEmail(link: string): EmailContent {
  return {
    subject: 'Reset your Ticketing password',
    text: [
      'Someone asked to reset the password for your Ticketing account.',
      '',
      'Choose a new password here:',
      link,
      '',
      'The link expires in 1 hour and can be used once.',
      "If you didn't ask for this, you can ignore this email; your password stays the same.",
    ].join('\n'),
    html: layout({
      preheader: 'Choose a new password for your account.',
      heading: 'Reset your password',
      intro: 'Someone asked to reset the password for your Ticketing account. Choose a new one below.',
      button: 'Choose a new password',
      link,
      footer: "The link expires in 1 hour and can be used once. If you didn't ask for this, ignore this email.",
    }),
  };
}
