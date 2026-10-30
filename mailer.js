/* Booking emails (SMTP via nodemailer) + calendar invite (.ics) */
const nodemailer = require('nodemailer');

const SITE_URL = (process.env.SITE_URL || 'https://remarketplace.store').replace(/\/$/, '');
const FROM = process.env.MAIL_FROM || 'reMarketplace <info@remarketplace.store>';
let transport = null;
function mailer() {
  if (transport || !process.env.SMTP_HOST) return transport;
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: +(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || (process.env.SMTP_PORT || '465') === '465') === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Wall-clock time in an IANA zone -> UTC Date */
function zonedToUtc(date, time, tz) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(guess).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asTz = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asTz - guess.getTime()));
}
const icsDate = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const fold = s => s.replace(/(.{70})/g, '$1\r\n ');
function ics(b, start, end) {
  const t = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//reMarketplace//Booking//EN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${b.ref}@remarketplace.store`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    fold(`SUMMARY:${t('reMarketplace demo — ' + b.products.map(p => p.name).join(', '))}`),
    fold(`DESCRIPTION:${t(`Reference ${b.ref}\nProducts: ${b.products.map(p => p.name).join(', ')}\nLanguage: ${b.lang}\nSpecialist: ${b.specialist.name}\n\nThe meeting link will be sent by the ReSystem team before the call.`)}`),
    `ORGANIZER;CN=reMarketplace:mailto:${process.env.BOOKING_NOTIFY || 'info@remarketplace.store'}`,
    `ATTENDEE;CN=${t(b.name)};RSVP=TRUE:mailto:${b.email}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

function shell(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#F4F3F0;font-family:Arial,Helvetica,sans-serif;color:#141317">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F0;padding:24px 12px"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E4E1DB">
<tr><td style="background:#141317;padding:20px 28px"><span style="font-size:20px;font-weight:800;color:#FFFFFF">re</span><span style="font-size:20px;font-weight:800;color:#F7541D">Marketplace</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 14px;font-size:22px">${esc(title)}</h1>${body}</td></tr>
<tr><td style="padding:18px 28px;background:#F4F3F0;font-size:12px;color:#6E6A63">reMarketplace · part of the ReSystem ecosystem · Desert Tech Cloud Services LLC, Dubai, UAE<br><a href="${SITE_URL}" style="color:#C2421A">remarketplace.store</a> · <a href="mailto:info@remarketplace.store" style="color:#C2421A">info@remarketplace.store</a></td></tr>
</table></td></tr></table></body></html>`;
}
const row = (l, v) => `<tr><td style="padding:8px 0;color:#6E6A63;font-size:13px;width:130px;vertical-align:top">${esc(l)}</td><td style="padding:8px 0;font-size:14px;font-weight:bold">${v}</td></tr>`;
const productCards = ps => ps.map(p => `<tr><td style="padding:6px 0"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E4E1DB;border-radius:10px"><tr>
${p.image ? `<td width="96" style="padding:8px"><img src="${esc(p.image)}" width="88" height="56" alt="" style="display:block;border-radius:6px;object-fit:cover"></td>` : ''}
<td style="padding:8px 12px"><a href="${SITE_URL}/product/${esc(p.slug)}" style="color:#141317;font-weight:bold;font-size:15px;text-decoration:none">${esc(p.name)}</a><br><span style="color:#6E6A63;font-size:12px">${esc(p.category || '')}${p.tagline ? ' · ' + esc(p.tagline) : ''}</span></td></tr></table></td></tr>`).join('');

async function sendBookingEmails(b, cfg) {
  const t = mailer();
  if (!t) { console.warn('[mail] SMTP_HOST not set — booking emails not sent', b.ref); return { sent: false, reason: 'smtp_not_configured' }; }
  const start = zonedToUtc(b.date, b.time, cfg.timezone);
  const end = new Date(start.getTime() + cfg.durationMin * 60000);
  const when = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.timezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(start);
  const local = b.visitorTz && b.visitorTz !== cfg.timezone ? new Intl.DateTimeFormat('en-GB', { timeZone: b.visitorTz, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(start) : '';
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('reMarketplace demo — ' + b.products.map(p => p.name).join(', '))}&dates=${icsDate(start)}/${icsDate(end)}&details=${encodeURIComponent('Reference ' + b.ref)}`;
  const invite = { filename: 'remarketplace-demo.ics', content: ics(b, start, end), contentType: 'text/calendar; method=REQUEST; charset=UTF-8' };
  const details = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px">
    ${row('Reference', esc(b.ref))}${row('Date & time', esc(when) + ' (Dubai, GST)' + (local ? `<br><span style="font-weight:normal;color:#6E6A63;font-size:13px">Your time: ${esc(local)}</span>` : ''))}
    ${row('Duration', cfg.durationMin + ' minutes')}${row('Language', esc(b.lang))}${row('Specialist', esc(b.specialist.name) + (b.specialist.role ? `<br><span style="font-weight:normal;color:#6E6A63;font-size:13px">${esc(b.specialist.role)}</span>` : ''))}</table>`;

  const customer = shell(`Your demo is booked, ${b.name.split(' ')[0]}`, `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3B3934">Thanks for booking a walkthrough with the ReSystem team. Here are your details — a calendar invite is attached, and the meeting link will follow before the call.</p>
    ${details}
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#6E6A63;text-transform:uppercase;letter-spacing:.06em">Products you selected</p>
    <table width="100%" cellpadding="0" cellspacing="0">${productCards(b.products)}</table>
    <p style="margin:22px 0"><a href="${gcal}" style="background:#F7541D;color:#FFFFFF;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px">Add to Google Calendar</a></p>
    <p style="margin:0;font-size:13px;color:#6E6A63;line-height:1.6">Need to reschedule? Reply to this email or write to <a href="mailto:info@remarketplace.store" style="color:#C2421A">info@remarketplace.store</a> quoting ${esc(b.ref)}.</p>`);

  const internal = shell(`New demo booking · ${b.ref}`, `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">
    ${row('Name', esc(b.name))}${row('Email', `<a href="mailto:${esc(b.email)}" style="color:#C2421A">${esc(b.email)}</a>`)}${row('Company', esc(b.company))}
    ${b.phone ? row('Phone', esc(b.phone)) : ''}${b.role ? row('Role', esc(b.role)) : ''}</table>${details}
    <p style="margin:0 0 6px;font-size:13px;font-weight:bold;color:#6E6A63;text-transform:uppercase;letter-spacing:.06em">Products (${b.products.length})</p>
    <table width="100%" cellpadding="0" cellspacing="0">${productCards(b.products)}</table>
    ${b.notes ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:bold;color:#6E6A63">Notes</p><p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-line">${esc(b.notes)}</p>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#6E6A63">Signed in with reID: ${b.user ? esc(b.user.name || b.user.id) : 'no'} · Visitor time zone: ${esc(b.visitorTz || 'unknown')}</p>`);

  const results = await Promise.allSettled([
    t.sendMail({ from: FROM, to: cfg.notifyEmail, replyTo: b.email, subject: `New demo booking ${b.ref} — ${b.company} (${b.products.map(p => p.name).join(', ')})`, html: internal, attachments: [invite] }),
    t.sendMail({ from: FROM, to: `${b.name} <${b.email}>`, replyTo: cfg.notifyEmail, subject: `Your reMarketplace demo is booked — ${when}`, html: customer, attachments: [invite] })
  ]);
  results.forEach(r => { if (r.status === 'rejected') console.error('[mail]', r.reason && r.reason.message); });
  return { sent: results.every(r => r.status === 'fulfilled') };
}

module.exports = { sendBookingEmails, zonedToUtc };
