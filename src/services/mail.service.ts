import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  "https://developers.google.com/oauthplayground"
);

oauth2Client.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN,
});

const gmail = google.gmail({ version: "v1", auth: oauth2Client });

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

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    console.log("Email sent successfully via Gmail API. ID:", response.data.id);
    return response.data;
  } catch (error: any) {
    console.error("Failed to send email via Gmail API:", error?.response?.data || error);
    throw new Error(error?.message || "Failed to send email");
  }
};

// ============================================================
// EMAIL TEMPLATES & HELPERS
// ============================================================

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const emailContainer = (content: string) => `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7f9; margin: 0; padding: 20px; color: #1f2937; }
        .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; }
        .header { background: #111827; padding: 24px; text-align: center; color: #ffffff; }
        .body { padding: 24px; line-height: 1.6; }
        .badge { display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; border-radius: 4px; }
        .badge-pending { background: #fef3c7; color: #92400e; }
        .badge-confirmed { background: #dcfce7; color: #166534; }
        .badge-rejected { background: #fee2e2; color: #991b1b; }
        .table { width: 100%; border-collapse: collapse; margin-top: 16px; margin-bottom: 16px; }
        .table td { padding: 8px 12px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
        .table td.label { font-weight: 600; color: #4b5563; width: 40%; }
        .footer { padding: 16px 24px; background: #f9fafb; font-size: 13px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
        .btn { display: inline-block; padding: 10px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 500; margin-top: 12px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h2 style="margin:0; font-size: 20px;">NH37 Car Rentals</h2>
        </div>
        <div class="body">
          ${content}
        </div>
        <div class="footer">
          <p style="margin: 0;">NH37 Car Rentals • Need help? Contact support@nh37rentals.com</p>
        </div>
      </div>
    </body>
  </html>
`;

export interface BookingEmailData {
  bookingNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  carName: string;
  pickupLocation: string;
  dropLocation?: string | null;
  pickupAt: Date;
  returnAt: Date;
  rentalDays: number;
  rentalHours: number;
  rentalAmount: string | number;
  securityDeposit: string | number;
  totalAmount: string | number;
  rejectionReason?: string | null;
  adminNote?: string | null;
}

// 1. Booking Received Email (Sent to Customer)
export const sendBookingReceivedCustomerEmail = async (data: BookingEmailData) => {
  const content = `
    <h3>Booking Request Received</h3>
    <p>Hi ${data.customerName},</p>
    <p>We received your booking request <span class="badge badge-pending">PENDING</span>. Our team is reviewing the availability and documents. We will update you shortly once confirmed.</p>
    
    <table class="table">
      <tr><td class="label">Booking Ref:</td><td><strong>${data.bookingNumber}</strong></td></tr>
      <tr><td class="label">Vehicle:</td><td>${data.carName}</td></tr>
      <tr><td class="label">Pickup Date:</td><td>${formatDate(data.pickupAt)}</td></tr>
      <tr><td class="label">Return Date:</td><td>${formatDate(data.returnAt)}</td></tr>
      <tr><td class="label">Pickup Location:</td><td>${data.pickupLocation}</td></tr>
      ${data.dropLocation ? `<tr><td class="label">Drop Location:</td><td>${data.dropLocation}</td></tr>` : ""}
      <tr><td class="label">Duration:</td><td>${data.rentalDays} days ${data.rentalHours > 0 ? `, ${data.rentalHours} hrs` : ""}</td></tr>
      <tr><td class="label">Rental Charge:</td><td>₹${data.rentalAmount}</td></tr>
      <tr><td class="label">Security Deposit:</td><td>₹${data.securityDeposit}</td></tr>
      <tr><td class="label">Total Amount:</td><td><strong>₹${data.totalAmount}</strong></td></tr>
    </table>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Booking Request Received - ${data.bookingNumber}`,
    html: emailContainer(content),
  });
};

// 2. New Booking Alert (Sent to Fixed Admin Email)
export const sendNewBookingAdminAlert = async (data: BookingEmailData) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
  if (!adminEmail) return;

  const dashboardUrl = `${process.env.ADMIN_PORTAL_URL || process.env.FRONTEND_URL}/admin/bookings`;

  const content = `
    <h3>New Booking Request Submitted</h3>
    <p>A new car booking request has been created and requires review.</p>
    
    <table class="table">
      <tr><td class="label">Booking Ref:</td><td><strong>${data.bookingNumber}</strong></td></tr>
      <tr><td class="label">Customer Name:</td><td>${data.customerName}</td></tr>
      <tr><td class="label">Customer Email:</td><td>${data.customerEmail}</td></tr>
      <tr><td class="label">Customer Phone:</td><td>${data.customerPhone || "N/A"}</td></tr>
      <tr><td class="label">Vehicle:</td><td>${data.carName}</td></tr>
      <tr><td class="label">Pickup Date:</td><td>${formatDate(data.pickupAt)}</td></tr>
      <tr><td class="label">Return Date:</td><td>${formatDate(data.returnAt)}</td></tr>
      <tr><td class="label">Pickup Location:</td><td>${data.pickupLocation}</td></tr>
      <tr><td class="label">Estimated Total:</td><td><strong>₹${data.totalAmount}</strong></td></tr>
    </table>

    <a href="${dashboardUrl}" class="btn">View in Admin Dashboard</a>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `🚨 New Booking Received: ${data.bookingNumber} (${data.carName})`,
    html: emailContainer(content),
  });
};

// 3. Booking Confirmed Email (Sent to Customer)
export const sendBookingConfirmedCustomerEmail = async (data: BookingEmailData) => {
  const content = `
    <h3>Your Booking is Confirmed!</h3>
    <p>Dear ${data.customerName},</p>
    <p>Great news! Your booking has been approved and confirmed <span class="badge badge-confirmed">CONFIRMED</span>.</p>

    <table class="table">
      <tr><td class="label">Booking Ref:</td><td><strong>${data.bookingNumber}</strong></td></tr>
      <tr><td class="label">Vehicle:</td><td>${data.carName}</td></tr>
      <tr><td class="label">Pickup Date:</td><td>${formatDate(data.pickupAt)}</td></tr>
      <tr><td class="label">Return Date:</td><td>${formatDate(data.returnAt)}</td></tr>
      <tr><td class="label">Pickup Location:</td><td>${data.pickupLocation}</td></tr>
      <tr><td class="label">Payable Total:</td><td><strong>₹${data.totalAmount}</strong></td></tr>
      ${data.adminNote ? `<tr><td class="label">Notes:</td><td>${data.adminNote}</td></tr>` : ""}
    </table>

    <p>Please remember to bring your original driving license and ID at the time of vehicle pickup.</p>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Booking Confirmed: ${data.bookingNumber} - NH37 Car Rentals`,
    html: emailContainer(content),
  });
};

// 4. Booking Rejected / Cancelled Email (Sent to Customer)
export const sendBookingRejectedCustomerEmail = async (data: BookingEmailData) => {
  const content = `
    <h3>Booking Update: Request Not Approved</h3>
    <p>Dear ${data.customerName},</p>
    <p>We regret to inform you that your booking request <span class="badge badge-rejected">REJECTED</span> could not be confirmed.</p>

    <table class="table">
      <tr><td class="label">Booking Ref:</td><td><strong>${data.bookingNumber}</strong></td></tr>
      <tr><td class="label">Vehicle:</td><td>${data.carName}</td></tr>
      <tr><td class="label">Pickup Date:</td><td>${formatDate(data.pickupAt)}</td></tr>
      ${data.rejectionReason ? `<tr><td class="label">Reason:</td><td style="color:#b91c1c;">${data.rejectionReason}</td></tr>` : ""}
    </table>

    <p>If you have any questions or would like to choose another vehicle or timeslot, please contact our support team or try booking another vehicle.</p>
  `;

  return sendEmail({
    to: data.customerEmail,
    subject: `Booking Update: ${data.bookingNumber}`,
    html: emailContainer(content),
  });
};