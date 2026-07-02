export const withdrawalEmailTemplates = {
  pending: {
    subject: '💸 Withdrawal Request Submitted',
    getHtml: (data: any) => `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8f9fa;border-radius:12px">
        <div style="background:#6C63FF;padding:20px;border-radius:12px 12px 0 0;text-align:center;color:white">
          <h1 style="margin:0">💸 Withdrawal Request</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hi ${data.userName},</p>
          <p>Your withdrawal request has been <strong>submitted successfully</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:bold">${data.amount_coins} coins (PKR ${data.amount_pkr})</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Method</td><td style="padding:8px;font-weight:bold">${data.method.toUpperCase()}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Account</td><td style="padding:8px;font-weight:bold">${data.account_number}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Status</td><td style="padding:8px"><span style="background:#FEF3C7;color:#D97706;padding:2px 8px;border-radius:4px">Pending</span></td></tr>
          </table>
          ${data.is_first ? '<p style="background:#EDE9FE;padding:12px;border-radius:8px;color:#6C63FF;font-size:14px">⚠️ Your first withdrawal will be manually verified within 24-48 hours.</p>' : ''}
          <p style="color:#6b7280;font-size:14px">You will be notified once your request is processed.</p>
          <hr style="border:1px solid #f3f4f6;margin:16px 0">
          <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
        </div>
      </div>
    `,
  },
  approved: {
    subject: '✅ Withdrawal Approved',
    getHtml: (data: any) => `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8f9fa;border-radius:12px">
        <div style="background:#10B981;padding:20px;border-radius:12px 12px 0 0;text-align:center;color:white">
          <h1 style="margin:0">✅ Withdrawal Approved</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hi ${data.userName},</p>
          <p>Your withdrawal request has been <strong>approved</strong> and is now being processed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:bold">${data.amount_coins} coins (PKR ${data.amount_pkr})</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Method</td><td style="padding:8px;font-weight:bold">${data.method.toUpperCase()}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Account</td><td style="padding:8px;font-weight:bold">${data.account_number}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Status</td><td style="padding:8px"><span style="background:#D1FAE5;color:#065F46;padding:2px 8px;border-radius:4px">Approved</span></td></tr>
            ${data.admin_note ? `<tr><td style="padding:8px;color:#6b7280">Note</td><td style="padding:8px">${data.admin_note}</td></tr>` : ''}
          </table>
          <p style="color:#6b7280;font-size:14px">Payment will be sent to your account shortly.</p>
          <hr style="border:1px solid #f3f4f6;margin:16px 0">
          <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
        </div>
      </div>
    `,
  },
  rejected: {
    subject: '❌ Withdrawal Rejected',
    getHtml: (data: any) => `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8f9fa;border-radius:12px">
        <div style="background:#EF4444;padding:20px;border-radius:12px 12px 0 0;text-align:center;color:white">
          <h1 style="margin:0">❌ Withdrawal Rejected</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hi ${data.userName},</p>
          <p>Your withdrawal request has been <strong>rejected</strong>.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:bold">${data.amount_coins} coins (PKR ${data.amount_pkr})</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Method</td><td style="padding:8px;font-weight:bold">${data.method.toUpperCase()}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Status</td><td style="padding:8px"><span style="background:#FEE2E2;color:#991B1B;padding:2px 8px;border-radius:4px">Rejected</span></td></tr>
            ${data.admin_note ? `<tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Reason</td><td style="padding:8px">${data.admin_note}</td></tr>` : ''}
          </table>
          ${data.refund ? `<p style="background:#EDE9FE;padding:12px;border-radius:8px;color:#6C63FF;font-size:14px">✅ ${data.amount_coins} coins have been restored to your wallet.</p>` : ''}
          <p style="color:#6b7280;font-size:14px">Please contact support if you have any questions.</p>
          <hr style="border:1px solid #f3f4f6;margin:16px 0">
          <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
        </div>
      </div>
    `,
  },
  paid: {
    subject: '💰 Payment Sent!',
    getHtml: (data: any) => `
      <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:24px;background:#f8f9fa;border-radius:12px">
        <div style="background:#6C63FF;padding:20px;border-radius:12px 12px 0 0;text-align:center;color:white">
          <h1 style="margin:0">💰 Payment Sent!</h1>
        </div>
        <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb">
          <p>Hi ${data.userName},</p>
          <p>Your withdrawal payment has been <strong>sent successfully</strong>!</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
            <tr><td style="padding:8px;color:#6b7280">Amount</td><td style="padding:8px;font-weight:bold">PKR ${data.amount_pkr}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Method</td><td style="padding:8px;font-weight:bold">${data.method.toUpperCase()}</td></tr>
            <tr><td style="padding:8px;color:#6b7280">Account</td><td style="padding:8px;font-weight:bold">${data.account_number}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding:8px;color:#6b7280">Reference</td><td style="padding:8px;font-weight:bold">${data.payment_reference || 'N/A'}</td></tr>
          </table>
          <p style="color:#6b7280;font-size:14px">Thank you for using YouTask!</p>
          <hr style="border:1px solid #f3f4f6;margin:16px 0">
          <p style="color:#9ca3af;font-size:12px;text-align:center">YouTask — Listen. Earn. Withdraw.</p>
        </div>
      </div>
    `,
  },
};