// cSpell:ignore Firestore
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";

export class NotificationService {
  // Email notification types
  static NotificationTypes = {
    SIGNATURE_REQUEST: "signature_request",
    DOCUMENT_SIGNED: "document_signed",
    DOCUMENT_COMPLETED: "document_completed",
    REMINDER: "reminder",
    DOCUMENT_DECLINED: "document_declined",
    DOCUMENT_EXPIRED: "document_expired",
  };

  // Email templates
  static EmailTemplates = {
    [this.NotificationTypes.SIGNATURE_REQUEST]: {
      subject: "You have been requested to sign a document",
      template: "signature-request",
    },
    [this.NotificationTypes.DOCUMENT_SIGNED]: {
      subject: "Document has been signed",
      template: "document-signed",
    },
    [this.NotificationTypes.DOCUMENT_COMPLETED]: {
      subject: "All signatures have been completed",
      template: "document-completed",
    },
    [this.NotificationTypes.REMINDER]: {
      subject: "Reminder: Please sign your document",
      template: "reminder",
    },
    [this.NotificationTypes.DOCUMENT_DECLINED]: {
      subject: "Document signature was declined",
      template: "document-declined",
    },
    [this.NotificationTypes.DOCUMENT_EXPIRED]: {
      subject: "Document signature request has expired",
      template: "document-expired",
    },
  };

  // Create a notification record
  static async createNotification(notificationData) {
    try {
      const notification = {
        ...notificationData,
        status: "pending",
        attempts: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(db, "notifications"),
        notification
      );

      // For now, we'll simulate sending the email
      // In production, this would trigger a Firebase Function
      await this.processNotification(docRef.id, notification);

      return docRef.id;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw new Error("Failed to create notification");
    }
  }

  // Send signature request email
  static async sendSignatureRequest(
    documentId,
    signer,
    requesterName,
    documentTitle
  ) {
    const signingUrl = `${window.location.origin}/sign/${documentId}/${signer.id}`;

    return await this.createNotification({
      type: this.NotificationTypes.SIGNATURE_REQUEST,
      documentId,
      recipientEmail: signer.email,
      recipientName: signer.name,
      templateData: {
        signerName: signer.name,
        requesterName,
        documentTitle,
        signingUrl,
        expirationDate: signer.expirationDate || null,
      },
    });
  }

  // Send document completion notification
  static async sendDocumentCompleted(documentId, document, recipients) {
    const notifications = [];

    for (const recipient of recipients) {
      const notificationId = await this.createNotification({
        type: this.NotificationTypes.DOCUMENT_COMPLETED,
        documentId,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        templateData: {
          recipientName: recipient.name,
          documentTitle: document.title,
          completedAt: new Date().toLocaleDateString(),
          downloadUrl: document.fileUrl,
        },
      });
      notifications.push(notificationId);
    }

    return notifications;
  }

  // Send reminder email
  static async sendReminder(
    documentId,
    signer,
    requesterName,
    documentTitle,
    daysOverdue = 0
  ) {
    const signingUrl = `${window.location.origin}/sign/${documentId}/${signer.id}`;

    let urgency;
    if (daysOverdue > 7) {
      urgency = "high";
    } else if (daysOverdue > 3) {
      urgency = "medium";
    } else {
      urgency = "low";
    }

    return await this.createNotification({
      type: this.NotificationTypes.REMINDER,
      documentId,
      recipientEmail: signer.email,
      recipientName: signer.name,
      templateData: {
        signerName: signer.name,
        requesterName,
        documentTitle,
        signingUrl,
        daysOverdue,
        urgency,
      },
    });
  }

  // Send signer update notification (someone signed)
  static async sendSignerUpdate(
    documentId,
    signerWhoSigned,
    document,
    remainingSigners
  ) {
    const notifications = [];

    // Notify the document creator
    if (document.createdByEmail) {
      const notificationId = await this.createNotification({
        type: this.NotificationTypes.DOCUMENT_SIGNED,
        documentId,
        recipientEmail: document.createdByEmail,
        recipientName: document.createdByName || "Document Creator",
        templateData: {
          recipientName: document.createdByName || "Document Creator",
          signerName: signerWhoSigned.name,
          documentTitle: document.title,
          signedAt: new Date().toLocaleDateString(),
          remainingSigners: remainingSigners.length,
          isComplete: remainingSigners.length === 0,
        },
      });
      notifications.push(notificationId);
    }

    return notifications;
  }

  // Process notification (simulate email sending for now)
  static async processNotification(notificationId, notification) {
    try {
      console.log("📧 Email Notification (Simulated):", {
        type: notification.type,
        to: notification.recipientEmail,
        subject: this.EmailTemplates[notification.type]?.subject,
        templateData: notification.templateData,
      });

      // Update notification status
      await updateDoc(doc(db, "notifications", notificationId), {
        status: "sent",
        sentAt: serverTimestamp(),
        attempts: 1,
        updatedAt: serverTimestamp(),
      });

      return true;
    } catch (error) {
      console.error("Error processing notification:", error);

      // Update notification with error
      await updateDoc(doc(db, "notifications", notificationId), {
        status: "failed",
        error: error.message,
        attempts: 1,
        updatedAt: serverTimestamp(),
      });

      throw error;
    }
  }

  // Get notification history for a document
  static async getDocumentNotifications(documentId) {
    try {
      const q = query(
        collection(db, "notifications"),
        where("documentId", "==", documentId)
      );

      const querySnapshot = await getDocs(q);
      const notifications = [];

      querySnapshot.forEach((doc) => {
        notifications.push({ id: doc.id, ...doc.data() });
      });

      return notifications.sort(
        (a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()
      );
    } catch (error) {
      console.error("Error getting document notifications:", error);
      throw new Error("Failed to get notifications");
    }
  }

  // Get user's notification preferences
  static async getUserNotificationPreferences() {
    // For now, return default preferences
    // In the future, this would fetch from user profile
    return {
      emailNotifications: true,
      documentReminders: true,
      statusUpdates: true,
      reminderFrequency: "daily", // daily, weekly, never
    };
  }

  // Schedule automatic reminders for pending signatures
  static async scheduleReminders(documentId, signers) {
    // This would be handled by Firebase Functions with scheduled triggers
    // For now, we'll just log the scheduling intent
    console.log(
      "📅 Scheduled reminders for document:",
      documentId,
      "signers:",
      signers.length
    );

    // In production, this would create scheduled jobs or use Firebase Functions with cron
    return true;
  }
}

export default NotificationService;
