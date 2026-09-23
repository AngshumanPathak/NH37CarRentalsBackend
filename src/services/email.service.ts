import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

// Set your permanent refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

// Helper function to encode raw RFC 2822 email to URL-safe base64
function makeEmail({
  to,
  from,
  subject,
  html,
}: {
  to: string;
  from: string;
  subject: string;
  html: string;
}): string {
  const str = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: =?utf-8?B?${Buffer.from(subject).toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ].join("\r\n");

  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  try {
    const raw = makeEmail({
      to,
      from: `"NH37 Car Rentals" <${process.env.GMAIL_USER}>`,
      subject,
      html,
    });

    // Sends over standard HTTPS (Port 443)
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw,
      },
    });

    console.log("Email sent successfully via Gmail API. Message ID:", response.data.id);
    return response.data;
  } catch (error: any) {
    console.error("Failed to send email via Gmail API:", error?.response?.data || error);
    throw new Error(error?.message || "Failed to send email");
  }
};

export const sendVerificationEmail = async (
  email: string,
  token: string
) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Verify your NH37 Car Rentals email",
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>Welcome to NH37 Car Rentals</h2>
          <p>Thanks for creating an account. Please verify your email address by clicking the button below.</p>
          <a
            href="${verificationUrl}"
            style="display:inline-block;padding:12px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Verify Email
          </a>
          <p>This verification link will expire soon.</p>
          <p>If you did not create this account, you can safely ignore this email.</p>
          <p>— NH37 Car Rentals</p>
        </body>
      </html>
    `,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  token: string
) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Reset your NH37 Car Rentals password",
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>Password Reset</h2>
          <p>We received a request to reset your NH37 Car Rentals password.</p>
          <a
            href="${resetUrl}"
            style="display:inline-block;padding:12px 20px;background:#000;color:#fff;text-decoration:none;border-radius:6px;"
          >
            Reset Password
          </a>
          <p>This link will expire shortly.</p>
          <p>If you didn't request a password reset, you can ignore this email.</p>
          <p>— NH37 Car Rentals</p>
        </body>
      </html>
    `,
  });
};