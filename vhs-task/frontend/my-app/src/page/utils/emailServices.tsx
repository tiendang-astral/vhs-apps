// Email Notification Service (Mock implementation)
export interface EmailNotification {
  recipient: string;
  subject: string;
  action: 'submit' | 'approve' | 'reject' | 'notify';
  itemId: string;
  itemName: string;
  approver?: string;
  rejectionReason?: string;
  timestamp: string;
}

export const sendEmailNotification = async (notification: EmailNotification): Promise<boolean> => {
  try {
    // Mock API call - In production, this would call a real email service
    console.log('[Email Service] Sending notification:', notification);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock response
    return true;
  } catch (error) {
    console.error('[Email Service] Error sending email:', error);
    return false;
  }
};

export const getEmailTemplate = (action: string, itemName: string, approver?: string): string => {
  const templates: Record<string, string> = {
    submit: `Bạn đã gửi yêu cầu: "${itemName}" cho duyệt\nHệ thống sẽ thông báo khi có cập nhật.`,
    approve: `"${itemName}" đã được phê duyệt bởi ${approver}`,
    reject: `"${itemName}" bị từ chối. Vui lòng kiểm tra lý do từ chối.`,
    notify: `Có yêu cầu duyệt chờ: "${itemName}"`
  };
  return templates[action] || 'Thông báo từ hệ thống quản lý kho';
};

export const notifyManagers = async (itemId: string, itemName: string, submittedBy: string) => {
  const managers = ['manager1@company.com', 'manager2@company.com'];
  
  for (const manager of managers) {
    await sendEmailNotification({
      recipient: manager,
      subject: `Yêu cầu duyệt: ${itemName}`,
      action: 'notify',
      itemId,
      itemName,
      timestamp: new Date().toISOString()
    });
  }
};

export const notifyApprover = async (itemId: string, itemName: string, approver: string, status: 'approve' | 'reject', submittedBy: string) => {
  await sendEmailNotification({
    recipient: submittedBy,
    subject: `${status === 'approve' ? 'Đã phê duyệt' : 'Bị từ chối'}: ${itemName}`,
    action: status,
    itemId,
    itemName,
    approver: approver,
    timestamp: new Date().toISOString()
  });
};
