import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
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
      from: process.env.SMTP_FROM,
      to,
      subject,
      html,
    });

    console.log("Email sent:", info.messageId);

    return info;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw new Error("Failed to send email");
  }
};



export const sendVerificationEmail = async (
  email: string,
  token: string
) => {
  const verificationUrl =
    `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

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

          <p>
            This verification link will expire soon.
          </p>

          <p>
            If you did not create this account, you can safely ignore this email.
          </p>

          <p>
            — NH37 Car Rentals
          </p>
        </body>
      </html>
    `,
  });
};


export const sendPasswordResetEmail = async (
  email: string,
  token: string
) => {
  const resetUrl =
    `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  return sendEmail({
    to: email,
    subject: "Reset your NH37 Car Rentals password",
    html: `
      <!DOCTYPE html>
      <html>
        <body>
          <h2>Password Reset</h2>

          <p>
            We received a request to reset your NH37 Car Rentals password.
          </p>

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

          <p>
            This link will expire shortly.
          </p>

          <p>
            If you didn't request a password reset, you can ignore this email.
          </p>

          <p>
            — NH37 Car Rentals
          </p>
        </body>
      </html>
    `,
  });
};

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection failed:", error);
  } else {
    console.log("SMTP server is ready");
  }
});