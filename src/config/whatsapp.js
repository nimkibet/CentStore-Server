// WhatsApp Bot Stub - Puppeteer bot removed by request.
// Frontend handles WhatsApp redirects via links.

export const initializeWhatsApp = () => {
  console.log('WhatsApp Bot is disabled (Bot functionality removed, using direct frontend links).');
  return null;
};

export const getWhatsAppStatus = () => {
  return {
    status: 'disabled',
    qr: null
  };
};

export const sendWhatsAppMessage = async (phoneNumber, message) => {
  console.log(`WhatsApp message dispatch skipped (bot disabled): to ${phoneNumber}`);
  return true;
};

export default null;
