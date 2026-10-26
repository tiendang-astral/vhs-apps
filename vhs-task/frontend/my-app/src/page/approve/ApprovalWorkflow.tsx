'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { WorkflowStatus, UserRole, getStatusLabel, getStatusColor, canApprove } from '../utils/workflowUtils';

interface ApprovalWorkflowProps {
  status: WorkflowStatus;
  userRole: UserRole;
  onApprove: (note: string) => void;
  onReject: (reason: string) => void;
  approve1By?: string;
  approve1At?: string;
  approve2By?: string;
  approve2At?: string;
  createdBy?: string;
  createdAt?: string;
}

export default function ApprovalWorkflow({
  status,
  userRole,
  onApprove,
  onReject,
  approve1By,
  approve1At,
  approve2By,
  approve2At,
  createdBy,
  createdAt
}: ApprovalWorkflowProps) {
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [note, setNote] = useState('');
  const canUserApprove = canApprove(status, userRole);

  const handleSubmitAction = () => {
    if (actionType === 'approve') {
      onApprove(note);
    } else {
      onReject(note);
    }
    setNote('');
    setShowModal(false);
  };

  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  return (
    <div className="bg-white border border-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Quy trình phê duyệt</h3>

      {/* Status Badge */}
      <div className="mb-6">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-4 mb-6">
        {/* Draft Stage */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white">
              ✓
            </div>
            <div className="w-0.5 h-12 bg-border mt-2" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Khởi tạo</p>
            <p className="text-sm text-muted-foreground">{createdBy} vào {createdAt}</p>
          </div>
        </div>

        {/* Approve 1 Stage */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              ['pending_approve1', 'pending_approve2', 'approved'].includes(status)
                ? 'bg-blue-500'
                : 'bg-gray-300'
            }`}>
              {approve1By ? '✓' : (status === 'pending_approve1' || status.includes('approve2') || status === 'approved' ? '⟳' : '-')}
            </div>
            {status !== 'draft' && <div className="w-0.5 h-12 bg-border mt-2" />}
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Duyệt 1 - Trưởng phòng</p>
            {approve1By ? (
              <p className="text-sm text-green-600">{approve1By} đã phê duyệt vào {approve1At}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {status === 'pending_approve1' ? 'Chờ duyệt' : 'Chưa bắt đầu'}
              </p>
            )}
          </div>
        </div>

        {/* Approve 2 Stage */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              ['pending_approve2', 'approved'].includes(status)
                ? 'bg-blue-500'
                : 'bg-gray-300'
            }`}>
              {approve2By ? '✓' : (status === 'pending_approve2' || status === 'approved' ? '⟳' : '-')}
            </div>
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Duyệt 2 - TGĐ</p>
            {approve2By ? (
              <p className="text-sm text-green-600">{approve2By} đã phê duyệt vào {approve2At}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {status === 'pending_approve2' ? 'Chờ duyệt' : 'Chưa bắt đầu'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      {canUserApprove && status !== 'approved' && status !== 'rejected' && (
        <div className="flex gap-3 pt-4 border-t border-border">
          <button
            onClick={() => {
              setActionType('approve');
              setShowModal(true);
            }}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Phê duyệt
          </button>
          <button
            onClick={() => {
              setActionType('reject');
              setShowModal(true);
            }}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Từ chối
          </button>
        </div>
      )}

      {/* Action Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {actionType === 'approve' ? 'Phê duyệt' : 'Từ chối'}
            </h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={actionType === 'approve' ? 'Ghi chú (tùy chọn)' : 'Lý do từ chối (bắt buộc)'}
              className="w-full border border-border rounded-lg px-3 py-2 text-foreground bg-background mb-4 h-24"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitAction}
                disabled={actionType === 'reject' && !note.trim()}
                className={`px-4 py-2 rounded-lg text-white ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {actionType === 'approve' ? 'Phê duyệt' : 'Từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
