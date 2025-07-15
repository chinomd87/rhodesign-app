// cSpell:ignore RhodeSign
// Email template utilities and HTML generation
export class EmailTemplates {
  // Base email HTML template
  static getBaseTemplate(content, title = "RhodeSign") {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 32px 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
        }
        .content {
            padding: 32px 24px;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            text-align: center;
            margin: 16px 0;
        }
        .button:hover {
            background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
        }
        .footer {
            background-color: #f8fafc;
            padding: 24px;
            text-align: center;
            font-size: 14px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
        }
        .document-info {
            background-color: #f1f5f9;
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
            border-left: 4px solid #4f46e5;
        }
        .urgent {
            border-left-color: #ef4444;
            background-color: #fef2f2;
        }
        .success {
            border-left-color: #10b981;
            background-color: #f0fdf4;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RhodeSign</h1>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>This email was sent from RhodeSign, your secure digital signature platform.</p>
            <p>If you have any questions, please contact our support team.</p>
            <p>&copy; 2025 RhodeSign. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;
  }

  // Signature request email template
  static signatureRequest(templateData) {
    const {
      signerName,
      requesterName,
      documentTitle,
      signingUrl,
      expirationDate,
    } = templateData;

    const expirationText = expirationDate
      ? `<p><strong>⏰ This request expires on:</strong> ${new Date(
          expirationDate
        ).toLocaleDateString()}</p>`
      : "";

    const content = `
      <h2>Hello ${signerName},</h2>
      <p>You have been requested to review and sign a document.</p>
      
      <div class="document-info">
        <h3 style="margin-top: 0;">📄 Document Details</h3>
        <p><strong>Document:</strong> ${documentTitle}</p>
        <p><strong>Requested by:</strong> ${requesterName}</p>
        ${expirationText}
      </div>

      <p>To review and sign this document, please click the button below:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${signingUrl}" class="button">Review & Sign Document</a>
      </div>

      <p><strong>What happens next?</strong></p>
      <ul>
        <li>Click the link above to review the document</li>
        <li>Add your signature where indicated</li>
        <li>Submit the signed document</li>
        <li>All parties will be notified when complete</li>
      </ul>

      <p>If you have any questions about this document, please contact ${requesterName} directly.</p>
    `;

    return this.getBaseTemplate(content, `Sign Document: ${documentTitle}`);
  }

  // Document signed notification template
  static documentSigned(templateData) {
    const {
      recipientName,
      signerName,
      documentTitle,
      signedAt,
      remainingSigners,
      isComplete,
    } = templateData;

    const statusText = isComplete
      ? '<div class="document-info success"><h3 style="margin-top: 0;">✅ Document Complete!</h3><p>All required signatures have been collected.</p></div>'
      : `<div class="document-info"><h3 style="margin-top: 0;">📝 Signature Progress</h3><p>${remainingSigners} signature(s) still needed to complete this document.</p></div>`;

    const content = `
      <h2>Hello ${recipientName},</h2>
      <p>Great news! Your document has been signed.</p>
      
      <div class="document-info">
        <h3 style="margin-top: 0;">📄 Document Details</h3>
        <p><strong>Document:</strong> ${documentTitle}</p>
        <p><strong>Signed by:</strong> ${signerName}</p>
        <p><strong>Signed on:</strong> ${signedAt}</p>
      </div>

      ${statusText}

      ${
        isComplete
          ? `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${window.location.origin}/documents" class="button">View Completed Document</a>
        </div>
      `
          : ""
      }

      <p>You can view the current status and download the document from your RhodeSign dashboard.</p>
    `;

    return this.getBaseTemplate(content, `Document Signed: ${documentTitle}`);
  }

  // Document completion notification template
  static documentCompleted(templateData) {
    const { recipientName, documentTitle, completedAt, downloadUrl } =
      templateData;

    const content = `
      <h2>Hello ${recipientName},</h2>
      <p>🎉 Congratulations! Your document has been fully executed with all required signatures.</p>
      
      <div class="document-info success">
        <h3 style="margin-top: 0;">✅ Document Complete</h3>
        <p><strong>Document:</strong> ${documentTitle}</p>
        <p><strong>Completed on:</strong> ${completedAt}</p>
        <p>All parties have successfully signed this document.</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${downloadUrl}" class="button">Download Signed Document</a>
      </div>

      <p><strong>What's included:</strong></p>
      <ul>
        <li>Fully signed document with all signatures</li>
        <li>Complete audit trail and timestamps</li>
        <li>Legal certificate of completion</li>
      </ul>

      <p>Please save a copy of the signed document for your records. This document is legally binding and fully enforceable.</p>
    `;

    return this.getBaseTemplate(content, `Document Complete: ${documentTitle}`);
  }

  // Reminder email template
  static reminder(templateData) {
    const {
      signerName,
      requesterName,
      documentTitle,
      signingUrl,
      daysOverdue,
    } = templateData;

    let urgencyText;
    if (daysOverdue > 7) {
      urgencyText = `<div class="document-info urgent"><h3 style="margin-top: 0;">🚨 Urgent Reminder</h3><p>This document is ${daysOverdue} days overdue for signature.</p></div>`;
    } else if (daysOverdue > 3) {
      urgencyText = `<div class="document-info"><h3 style="margin-top: 0;">⏰ Friendly Reminder</h3><p>This document has been waiting ${daysOverdue} days for your signature.</p></div>`;
    } else {
      urgencyText = `<div class="document-info"><h3 style="margin-top: 0;">📋 Gentle Reminder</h3><p>This document is still awaiting your signature.</p></div>`;
    }

    const content = `
      <h2>Hello ${signerName},</h2>
      <p>This is a friendly reminder that you have a document waiting for your signature.</p>
      
      ${urgencyText}

      <div class="document-info">
        <h3 style="margin-top: 0;">📄 Document Details</h3>
        <p><strong>Document:</strong> ${documentTitle}</p>
        <p><strong>Requested by:</strong> ${requesterName}</p>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${signingUrl}" class="button">Sign Document Now</a>
      </div>

      <p>Signing this document only takes a few minutes:</p>
      <ul>
        <li>Click the link above to open the document</li>
        <li>Review the content carefully</li>
        <li>Add your signature where indicated</li>
        <li>Submit to complete the process</li>
      </ul>

      <p>If you have any questions or concerns about this document, please contact ${requesterName} directly.</p>
    `;

    return this.getBaseTemplate(content, `Reminder: Sign ${documentTitle}`);
  }

  // Generate email preview for testing
  static generatePreview(type, templateData) {
    switch (type) {
      case "signature_request":
        return this.signatureRequest(templateData);
      case "document_signed":
        return this.documentSigned(templateData);
      case "document_completed":
        return this.documentCompleted(templateData);
      case "reminder":
        return this.reminder(templateData);
      default:
        return this.getBaseTemplate("<p>Unknown email template type.</p>");
    }
  }
}

export default EmailTemplates;
