"use client";
import React, { useState } from "react";
import { useAppContext } from "../../app/context/AppProvider";
import LeaveRegistrationForm from "./LeaveRegistrationForm";
import LeaveApprovalList from "./LeaveApprovalList";
import LeaveQuotaTable from "./LeaveQuotaTable";

import { 
  ClipboardList, 
  ShieldCheck,
  LayoutDashboard,
  FileText,
  FileSpreadsheet
} from "lucide-react";

export default function LeaveManagementPage() {
  const { user }: any = useAppContext();
  const [activeTab, setActiveTab] = useState<"register" | "approval" | "report" | "quota">("register");

  const userRole = user?.role?.toUpperCase() || "";
  const userDept = (user?.deptName || user?.departmentName || "").toUpperCase();

  // 1. Quyền phê duyệt: Giữ nguyên (Chỉ sếp và HCNS mới được duyệt đơn)
  const canApprove = ["ADMIN", "BOD", "CHAIRMAN", "MANAGER", "TP"].includes(userRole) || 
                     userDept.includes("HCNS") || userDept.includes("HÀNH CHÍNH");

  // 2. Quyền xem báo cáo TỔNG HỢP & ĐỊNH MỨC: 
  // Sửa thành true để tất cả mọi người trong công ty đều xem được
  const canViewEveryone = true; 

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <FileText className="text-blue-600" size={24} />
            Quản lý nghỉ phép
          </h2>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
          {/* Tab mặc định: Ai cũng có */}
          <button
            onClick={() => setActiveTab("register")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${
              activeTab === "register" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            }`}
          >
            <ClipboardList size={14} /> Đăng ký cá nhân
          </button>

          {/* Tab Phê duyệt: Giữ nguyên logic cũ (Chỉ người có quyền mới thấy) */}
          {canApprove && (
            <button
              onClick={() => setActiveTab("approval")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${
                activeTab === "approval" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <ShieldCheck size={14} /> Phê duyệt đơn
            </button>
          )}

          {/* Tab Tổng hợp: Đã mở cho toàn công ty */}
          {canViewEveryone && (
            <button
              onClick={() => setActiveTab("report")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${
                activeTab === "report" ? "bg-white text-green-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <LayoutDashboard size={14} /> Tổng hợp hệ thống
            </button>
          )}

          {/* Tab Định mức phép: Đã mở cho toàn công ty */}
          {canViewEveryone && (
            <button
              onClick={() => setActiveTab("quota")}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-black text-[10px] uppercase transition-all ${
                activeTab === "quota" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <FileSpreadsheet size={14} /> Định mức phép
            </button>
          )}
        </div>
      </div>

      {/* Phần hiển thị nội dung các Tab */}
      <div className="relative min-h-[500px]">
        {activeTab === 'register' && <LeaveRegistrationForm user={user} />}
        
        {activeTab === 'approval' && <LeaveApprovalList user={user} isReportMode={false} />}
        
        {activeTab === 'report' && <LeaveApprovalList user={user} isReportMode={true} />}

        {activeTab === 'quota' && <LeaveQuotaTable user={user} />}
      </div>
    </div>
  );
}