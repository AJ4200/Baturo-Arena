let transporter = null;
try {
  const nodemailer = require('nodemailer');
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && port && user && pass) {
    transporter = nodemailer.createTransport({ host, port, auth: { user, pass }, secure: port === 465 });
  }
} catch (_e) {
  transporter = null;
}

function isConfigured() {
  return transporter !== null;
}

async function sendInviteEmail({ to, fromPlayerId, roomCode, message }) {
  if (!transporter) {
    throw new Error('SMTP not configured');
  }

  const subject = 'You have been invited to a Baturo Arena room';
  const body = `
You have been invited by player ${fromPlayerId} to join a game room${roomCode ? ` (code: ${roomCode})` : ''}.

Message:
${message || '(no message)'}

Visit ${process.env.APP_URL || 'the game'} to join.
`;

  await transporter.sendMail({ from: process.env.SMTP_FROM || 'noreply@baturo.arena', to, subject, text: body });
}

module.exports = { isConfigured, sendInviteEmail };
