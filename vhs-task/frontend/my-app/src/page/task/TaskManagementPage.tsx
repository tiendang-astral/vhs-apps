"use client";
import React, { useState, useMemo } from 'react';
import { useAppContext } from "../../app/context/AppProvider";

import TaskApprovalList from './TaskApprovalList';
import MonthlyTaskRegistration from './MonthlyTaskRegistration';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';

interface TaskManagementPageProps {
  targetDept?: { id: string, name: string } | null;
}

export default function TaskManagementPage({ targetDept }: TaskManagementPageProps) {
  const { user }: any = useAppContext();
  const [viewingUser, setViewingUser] = useState<{userId: string, month: string} | null>(null);

  // 1. Tự động lấy tháng hiện tại theo thời gian thực (YYYY-MM)
  const currentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  // Kiểm tra quyền xem danh sách duyệt (Boss mới được xem)
  const isBoss = ["ADMIN", "BOD", "CHAIRMAN", "MANAGER", "TP"].includes(user?.role?.toUpperCase() || "");

  // Nếu không phải sếp, mặc định xem trang đăng ký của mình ở tháng hiện tại
  if (!isBoss) {
    return <MonthlyTaskRegistration targetMonth={currentMonth} />;
  }

  return (
    <div className="space-y-4">
      {!viewingUser ? (
        <div className="space-y-4">
          <div className="flex gap-4 mb-4">
            <button 
              onClick={() => setViewingUser({userId: user?.id || "", month: currentMonth})}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition font-bold text-sm"
            >
              <ClipboardCheck size={18}/> Nhiệm vụ của tôi ({currentMonth})
            </button>
          </div>
          <TaskApprovalList 
            targetDeptId={targetDept?.id} 
            targetDeptName={targetDept?.name} 
            // Truyền currentMonth vào List để mặc định lọc theo tháng hiện tại khi load
            currentMonth={currentMonth}
            onViewDetail={(userId: string, month: string) => setViewingUser({userId, month})} 
          />
        </div>
      ) : (
        <div className="space-y-4">
          <button 
            onClick={() => setViewingUser(null)}
            className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-bold bg-white px-4 py-2 rounded shadow-sm w-max border transition text-sm uppercase tracking-wider"
          >
            <ArrowLeft size={16} /> Quay lại danh sách duyệt
          </button>
          <MonthlyTaskRegistration targetUserId={viewingUser.userId} targetMonth={viewingUser.month} />
        </div>
      )}
    </div>
  );
}