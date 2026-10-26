"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Eye, CheckCircle, Clock, Loader2, Building2 } from 'lucide-react';
import { useAppContext } from "../../app/context/AppProvider";
import { taskApi } from '../task/TaskApi'; 

// Nhãn & màu theo từng trạng thái (trước đây mọi trạng thái khác APPROVED đều hiện "CHỜ DUYỆT",
// kể cả nhân viên chưa đăng ký nhiệm vụ)
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  APPROVED: { label: 'ĐÃ DUYỆT', cls: 'bg-green-100 text-green-700 border-green-200' },
  PENDING_MANAGER: { label: 'CHỜ DUYỆT', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  PENDING_BOD: { label: 'CHỜ BGĐ DUYỆT', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  REJECTED: { label: 'ĐÃ TRẢ LẠI', cls: 'bg-red-100 text-red-700 border-red-200' },
  DRAFT: { label: 'ĐANG SOẠN', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  NOT_STARTED: { label: 'CHƯA ĐĂNG KÝ', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};
const getStatusBadge = (status?: string) => STATUS_BADGE[status || 'NOT_STARTED'] || STATUS_BADGE.NOT_STARTED;

interface TaskApprovalListProps {
  onViewDetail: (userId: string, month: string) => void;
  targetDeptId?: string;
  targetDeptName?: string;
  currentMonth?: string;
}

export default function TaskApprovalList({ onViewDetail, targetDeptId, targetDeptName, currentMonth }: TaskApprovalListProps) {
  const { user }: any = useAppContext(); 
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(() => {
    if (currentMonth) return currentMonth;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  
  // 1. LOAD DATA TỪ API
  useEffect(() => {
    const currentUserId = user?.id || localStorage.getItem('userId');
    if (!currentUserId) return;
    let cancelled = false; // bỏ qua response cũ khi đổi tháng liên tục

    const loadData = async () => {
      setLoading(true);
      try {
        const res: any = await taskApi.getApprovals(currentUserId, filterMonth);
        if (!cancelled && res.data?.code === 200) {
          setApprovals(res.data.data || []);
        }
      } catch (error) {
        console.error("Lỗi load danh sách duyệt:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadData();
    return () => { cancelled = true; };
  }, [filterMonth, user?.id]);

  // 2. LOGIC PHÂN QUYỀN & BỘ LỌC
  const filteredApprovals = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    return approvals.filter(item => {
      if (String(item.userId) === String(user?.id)) return false;

      const matchSearch = !keyword || (item.fullName || "").toLowerCase().includes(keyword);
      const matchStatus = filterStatus === "ALL" ? true : item.status === filterStatus;
      if (!matchSearch || !matchStatus) return false;

      const userRole = (user?.role || "").toUpperCase();
      const itemRole = (item.role || "").toUpperCase();
      const itemDeptId = item.departmentId ? String(item.departmentId) : "";
      const sidebarDeptId = targetDeptId ? String(targetDeptId) : null;

      if (sidebarDeptId) {
        if (itemDeptId !== sidebarDeptId) return false;
        if (userRole === 'CHAIRMAN' || userRole === 'ADMIN' || userRole === 'BOD') return true; 
        if (userRole === 'MANAGER') return itemRole !== 'BOD' && itemRole !== 'CHAIRMAN';
        return false;
      }

      if (userRole === 'CHAIRMAN' || userRole === 'ADMIN') return true;

      if (userRole === 'BOD') {
        const isSameCompany = item.companyName === user?.company;
        const isLowerRole = itemRole === 'MANAGER' || itemRole === 'STAFF' || itemRole === 'TP' || itemRole === 'EMPLOYEE';
        return isSameCompany && isLowerRole;
      }

      if (userRole === 'MANAGER') {
        return itemDeptId === String(user?.deptId) && (itemRole === 'STAFF' || itemRole === 'EMPLOYEE');
      }

      return false;
    });
  }, [approvals, searchQuery, filterStatus, user, targetDeptId]);

  // 3. XỬ LÝ HIỂN THỊ TÊN PHÒNG BAN (SỬA LẠI TẠI ĐÂY)
  const displayDeptName = useMemo(() => {
    // Ưu tiên 1: Nếu click Sidebar và tên khác với tên chức năng mặc định
    if (targetDeptName && targetDeptName !== "Đăng ký nhiệm vụ") return targetDeptName; 
    
    // Ưu tiên 2: Lấy tên phòng ban từ dữ liệu thực tế của nhân viên trong danh sách
    if (filteredApprovals.length > 0) return filteredApprovals[0].departmentName; 
    
    return "Toàn quyền hệ thống";
  }, [targetDeptName, filteredApprovals]);

  return (
    <div className="bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden font-sans">
      <div className="bg-[#1F3864] p-5 text-white flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
            <CheckCircle className="text-green-400" size={24} /> Phê duyệt nhiệm vụ
          </h2>
          <p className="text-blue-200 text-xs mt-1 italic font-medium">
             Đơn vị kiểm soát: <span className="text-yellow-400 font-bold uppercase underline decoration-yellow-400/30 underline-offset-4">
               {displayDeptName}
             </span>
          </p>
        </div>
      </div>

      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm theo tên nhân sự..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm w-64 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="text-sm py-2 px-3 border border-slate-300 rounded-lg bg-white font-medium text-slate-700 shadow-sm outline-none focus:border-blue-500"
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING_MANAGER">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Đã trả lại</option>
            <option value="DRAFT">Đang soạn</option>
            <option value="NOT_STARTED">Chưa đăng ký</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Kỳ kiểm soát:</span>
           <input 
            type="month" 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(e.target.value)} 
            className="outline-none text-blue-700 font-bold text-sm bg-transparent cursor-pointer" 
          />
        </div>
      </div>

      <div className="relative min-h-[450px]">
        {loading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-[1px]">
            <Loader2 className="animate-spin text-blue-600" size={32}/>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-100 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b">
                <tr>
                  <th className="px-6 py-4 w-16 text-center">STT</th>
                  <th className="px-6 py-4">Nhân sự thực hiện</th>
                  <th className="px-6 py-4">Chức vụ & Đơn vị</th>
                  <th className="px-6 py-4 text-center">Trạng thái</th>
                  <th className="px-6 py-4 text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {filteredApprovals.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-32 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Building2 size={48} />
                        <p className="font-bold uppercase tracking-widest text-xs">Không có dữ liệu phê duyệt</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApprovals.map((item, index) => (
                    <tr key={item.userId} className="hover:bg-blue-50/40 transition-all group">
                      <td className="px-6 py-5 text-center font-bold text-slate-300 group-hover:text-blue-600 transition-colors">
                        {index + 1}
                      </td>
                      <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-md border-2 border-white">
                                {item.fullName?.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 text-sm leading-tight group-hover:text-blue-900">{item.fullName}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-tighter group-hover:text-blue-500">
                                  ID: {item.userId?.substring(0, 8)}...
                                </div>
                              </div>
                          </div>
                      </td>
                      <td className="px-6 py-5">
                          <div className="font-black text-slate-700 text-[11px] uppercase tracking-tighter">{item.role}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                            <Building2 size={12} className="text-blue-400" /> {item.departmentName}
                          </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm uppercase ${getStatusBadge(item.status).cls}`}>
                          <Clock size={12}/>
                          {getStatusBadge(item.status).label}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                          <button 
                            onClick={() => onViewDetail(item.userId, filterMonth)} 
                            className="bg-white text-[#1F3864] px-4 py-2 rounded-lg hover:bg-[#1F3864] hover:text-white transition-all font-black text-[10px] shadow-sm border border-slate-200 uppercase tracking-widest active:scale-95 flex items-center gap-2 ml-auto"
                          >
                            <Eye size={14} /> Xem & Duyệt
                          </button>
                      </td>
                    </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}