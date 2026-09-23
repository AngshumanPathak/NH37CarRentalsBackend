import nodemailer from "nodemailer";

// Configure Nodemailer with Gmail OAuth2
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    type: "OAuth2",
    user: process.env.GMAIL_USER, // Your sending Gmail address
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN,
  },
});

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
    const info = await transporter.sendMail({
      from: `"NH37 Car Rentals" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully. Message ID:", info.messageId);
    return info;
  } catch (error: any) {
    console.error("Failed to send email:", error);
    throw new Error(error.message || "Failed to send email");
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
          <p>
            Thanks for creating an account.
            Please verify your email address by clicking the button below.
          </p>
          <a
            href="${verificationUrl}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#000;
              color:#fff;
              text-decoration:none;
              border-radius:6px;
            "
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
            style="
              display:inline-block;
              padding:12px 20px;
              background:#000;
              color:#fff;
              text-decoration:none;
              border-radius:6px;
            "
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

// Optional: verify token connection on startup
transporter.verify((error) => {
  if (error) {
    console.error("Gmail OAuth2 verification failed:", error);
  } else {
    console.log("Gmail OAuth2 transporter is ready to send emails");
  }
});