import blocklist from 'disposable-email-blocklist';

const commonDisposableDomains = [
  'mailinator.com',
  'yopmail.com',
  'tempmail.com',
  'dispostable.com',
  'sharklasers.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'trashmail.com'
];

export const isDisposableEmail = (email) => {
  if (!email || typeof email !== 'string') return true;
  
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true;

  // Check npm package list
  if (Array.isArray(blocklist)) {
    if (blocklist.includes(domain)) {
      return true;
    }
  }

  // Fallback check against common disposable domains
  if (commonDisposableDomains.includes(domain)) {
    return true;
  }

  return false;
};
