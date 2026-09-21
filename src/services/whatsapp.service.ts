export const sendWhatsAppOtp = async (
  phone: string,
  otp: string
) => {
  // Temporary development mode

  console.log("=================================");
  console.log("WHATSAPP OTP");
  console.log(`Phone: ${phone}`);
  console.log(`OTP: ${otp}`);
  console.log("=================================");

  return {
    success: true,
  };
};