const crypto = require('node:crypto');
const { normalizePasswordDigits } = require('./passwords');

const passwordHash = '556e6009da3e2fc77aace228fe35f47a680c8ff9c2ecedd12490e588388529f5';

function isAdminPassword(value) {
  const candidate = crypto
    .createHash('sha256')
    .update(normalizePasswordDigits(value))
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(passwordHash, 'hex'));
}

module.exports = { isAdminPassword };
