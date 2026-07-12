const RESEND_API_URL = "https://api.resend.com/emails";

type WorkspaceInviteEmailParams = {
  to: string;
  role: string;
  inviteUrl: string;
  workspaceName: string;
  invitedByName: string;
  invitedByEmail: string;
};

export type InviteEmailResult = {
  sent: boolean;
  provider: "resend" | "none";
  message: string;
};

function fromAddress() {
  return process.env.INVITE_EMAIL_FROM?.trim() || "Blue Arc OS <onboarding@resend.dev>";
}

function subject(params: WorkspaceInviteEmailParams) {
  return `${params.invitedByName} invited you to ${params.workspaceName}`;
}

function textBody(params: WorkspaceInviteEmailParams) {
  return [
    `${params.invitedByName} (${params.invitedByEmail}) invited you to join ${params.workspaceName} as ${params.role}.`,
    "",
    "Create an account or sign in with this email address to accept the invitation:",
    params.inviteUrl,
    "",
    "If you were not expecting this invitation, you can ignore this email.",
  ].join("\n");
}

function htmlBody(params: WorkspaceInviteEmailParams) {
  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 12px">Join ${params.workspaceName}</h2>
      <p>${params.invitedByName} (${params.invitedByEmail}) invited you to join <strong>${params.workspaceName}</strong> as <strong>${params.role}</strong>.</p>
      <p>
        <a href="${params.inviteUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none">
          Accept invitation
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">If the button does not work, copy and paste this URL: ${params.inviteUrl}</p>
    </div>
  `;
}

export async function sendWorkspaceInviteEmail(params: WorkspaceInviteEmailParams): Promise<InviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    return {
      sent: false,
      provider: "none",
      message: "RESEND_API_KEY is not configured; invitation was created but no email was sent.",
    };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: params.to,
        subject: subject(params),
        text: textBody(params),
        html: htmlBody(params),
      }),
    });
    const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };

    if (!response.ok) {
      return {
        sent: false,
        provider: "resend",
        message: payload.message || payload.error || "Resend rejected the invitation email.",
      };
    }

    return {
      sent: true,
      provider: "resend",
      message: "Invitation email sent.",
    };
  } catch (error) {
    return {
      sent: false,
      provider: "resend",
      message: error instanceof Error ? error.message : "Failed to send invitation email.",
    };
  }
}
