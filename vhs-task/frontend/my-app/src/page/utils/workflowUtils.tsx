// Workflow Status Management
export type WorkflowStatus = 'draft' | 'pending_approve1' | 'pending_approve2' | 'approved' | 'rejected';
export type UserRole = 'staff' | 'manager' | 'director' | 'admin';

export interface ApprovalRecord {
  id: string;
  status: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  approve1By?: string;
  approve1At?: string;
  approve1Note?: string;
  approve2By?: string;
  approve2At?: string;
  approve2Note?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export const getNextStatus = (currentStatus: WorkflowStatus, action: 'approve' | 'reject'): WorkflowStatus => {
  if (action === 'reject') return 'rejected';
  
  switch (currentStatus) {
    case 'draft':
      return 'pending_approve1';
    case 'pending_approve1':
      return 'pending_approve2';
    case 'pending_approve2':
      return 'approved';
    default:
      return currentStatus;
  }
};

export const canApprove = (status: WorkflowStatus, userRole: UserRole): boolean => {
  if (userRole === 'admin') return true;
  
  if (status === 'pending_approve1' && userRole === 'manager') return true;
  if (status === 'pending_approve2' && userRole === 'director') return true;
  
  return false;
};

export const getStatusLabel = (status: WorkflowStatus): string => {
  const labels: Record<WorkflowStatus, string> = {
    draft: 'Nháp',
    pending_approve1: 'Chờ duyệt (Trưởng phòng)',
    pending_approve2: 'Chờ duyệt (TGĐ)',
    approved: 'Đã duyệt',
    rejected: 'Từ chối'
  };
  return labels[status];
};

export const getStatusColor = (status: WorkflowStatus): string => {
  const colors: Record<WorkflowStatus, string> = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approve1: 'bg-yellow-100 text-yellow-800',
    pending_approve2: 'bg-blue-100 text-blue-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  };
  return colors[status];
};
