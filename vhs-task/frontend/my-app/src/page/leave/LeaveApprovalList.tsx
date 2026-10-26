"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { leaveApi } from './LeaveApi';
import { departmentApi } from '../department/departmentApi'; 
import ConfirmModal from '../../component/ConfirmModal'; 
import { 
  FileSpreadsheet, Building2, ShieldCheck, Clock, 
  CheckCircle2, Calendar, LayoutDashboard, User, ArrowRight,XCircle 
} from 'lucide-react';

interface LeaveApprovalListProps {
  user: any;
  isReportMode?: boolean; 
}

export default function LeaveApprovalList({ user, isReportMode = false }: LeaveApprovalListProps) {
  const [list, setList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 1. Lọc theo tháng (Xử lý tại Client) - Mặc định tháng hiện tại dạng YYYY-MM
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // 2. Lọc theo Công ty (Dành cho HCNS/CHAIRMAN)
  const [filterCompany, setFilterCompany] = useState(() => {
    const isPowerUser = user?.role?.toUpperCase() === "CHAIRMAN" || user?.deptName?.toUpperCase() === "HCNS";
    return isPowerUser ? "" : (user?.company || "VNEB");
  });
  
  const [filterDept, setFilterDept] = useState<string>(""); 

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean; title: string; message: string; requestId: number | null; isLoading: boolean; actionType: 'APPROVE' | 'REJECT'
  }>({
    isOpen: false, title: '', message: '', requestId: null, isLoading: false,actionType: 'APPROVE'
  });

  // Lấy danh sách phòng ban cho bộ lọc
  useEffect(() => {
    if (isReportMode || user?.deptName?.toUpperCase() === "HCNS" || user?.role?.toUpperCase() === "CHAIRMAN") {
      departmentApi.getDepartments().then(res => {
        const deptData = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        setDepartments(deptData);
      }).catch(err => console.error(err));
    }
  }, [isReportMode, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res: any = isReportMode 
        ? await leaveApi.getStatistical(filterCompany, filterDept ? parseInt(filterDept) : undefined) 
        : await leaveApi.getApprovals(); 
        
      if (res.data?.code === 200) setList(res.data.data || []);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { loadData(); }, [filterCompany, filterDept, isReportMode]); 

  // --- LOGIC LỌC THEO THÁNG TẠI CLIENT ---
  const filteredList = useMemo(() => {
    if (!filterMonth) return list;
    return list.filter(item => {
      if (!item.requestDate) return false;
      // So khớp chuỗi YYYY-MM từ API với filterMonth
      return item.requestDate.startsWith(filterMonth);
    });
  }, [list, filterMonth]);

const handleConfirmAction = async () => {
    if (!modalConfig.requestId) return;
    setModalConfig(prev => ({ ...prev, isLoading: true }));
    
    try {
      let res: any;
      if (modalConfig.actionType === 'APPROVE') {
        res = await leaveApi.approveAction(modalConfig.requestId, user.role);
      } else {
  
        const reason = prompt("Nhập lý do từ chối:", "Không phù hợp với lịch trình làm việc");
        if (reason === null) { 
           setModalConfig(prev => ({ ...prev, isOpen: false, isLoading: false }));
           return;
        }
        res = await leaveApi.rejectAction(modalConfig.requestId, reason);
      }

      if (res.data?.code === 200) {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        loadData();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setModalConfig(prev => ({ ...prev, isLoading: false }));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "---";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const renderDateRange = (startDate: string, endDate: string) => {
    const start = formatDate(startDate);
    const end = formatDate(endDate);
    if (!endDate || startDate === endDate || endDate.startsWith("0001")) return start;
    return (
      <span className="flex items-center gap-1">
        {start} <ArrowRight size={10} className="text-blue-400" /> {end}
      </span>
    );
  };

  // --- GIAO DIỆN 1: CARD VIEW ---
  const CardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {filteredList.map((item, idx) => {
        // HCNS thấy hết nhưng chỉ duyệt được đơn của phòng mình (Id phòng ban khớp nhau)
        const canApprove = 
          user?.role?.toUpperCase() === "CHAIRMAN" || 
          String(item.departmentId) === String(user?.departmentId);

        return (
          <div key={idx} className="bg-white rounded-[32px] p-7 shadow-xl border border-slate-100 hover:shadow-2xl transition-all relative group animate-in slide-in-from-bottom-4 duration-300">
            <div className="absolute top-6 right-6">
              <span className="inline-flex items-center gap-1.5 text-orange-600 font-black text-[9px] bg-orange-50 px-3 py-1 rounded-full border border-orange-100 uppercase">
                <Clock size={10} /> Chờ {item.currentApproverRole}
              </span>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-inner">
                <User size={28} />
              </div>
              <div>
                <h4 className="font-black text-slate-900 uppercase text-sm tracking-tight">{item.fullName}</h4>
                <p className="text-[10px] font-black text-blue-500 uppercase">
                  {item.company} - {item.departmentName}
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-slate-600">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-xs font-bold text-blue-700">
                  {renderDateRange(item.requestDate, item.endDate)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-slate-600">
                <Clock size={18} className="text-slate-400" />
                <span className="text-xs font-bold uppercase">{item.fromTime} - {item.toTime}</span>
              </div>
                            <div className="flex items-center gap-3 text-slate-600">
                Loại đơn: 
                <span className="text-xs font-bold uppercase">{item.confirmationType}</span>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 min-h-[60px]">
                <p className="text-[11px] text-slate-500 font-medium italic">"{item.reason || 'Không có lý do'}"</p>
              </div>
            </div>

           {canApprove ? (
              <div className="flex gap-3">
                {/* Nút Từ chối mới */}
                <button 
                  onClick={() => setModalConfig({ 
                    isOpen: true, 
                    title: "Từ chối đơn", 
                    message: `Bạn chắc chắn muốn từ chối và XÓA đơn của ${item.fullName}?`, 
                    requestId: item.id, 
                    isLoading: false,
                    actionType: 'REJECT'
                  })}
                  className="flex-1 py-4 rounded-2xl bg-red-50 text-red-600 text-[11px] font-black uppercase hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <XCircle size={14} /> Từ chối
                </button>

                {/* Nút Phê duyệt */}
                <button 
                  onClick={() => setModalConfig({ 
                    isOpen: true, 
                    title: "Phê duyệt", 
                    message: `Duyệt đơn nghỉ phép cho ${item.fullName}?`, 
                    requestId: item.id, 
                    isLoading: false,
                    actionType: 'APPROVE'
                  })}
                  className="flex-[2] py-4 rounded-2xl bg-[#1F3864] text-white text-[11px] font-black uppercase hover:bg-blue-800 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                >
                  Phê duyệt ngay
                </button>
              </div>
            ) : (
              <div className="w-full py-4 rounded-2xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase text-center border border-dashed border-slate-200 cursor-not-allowed">
                Chỉ xem (Quyền HCNS)
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // --- GIAO DIỆN 2: TABLE VIEW ---
  const TableView = () => (
    <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in duration-500">
      <div className="bg-slate-50/50 p-5 border-b border-slate-200 flex justify-between items-center">
        <span className="flex items-center gap-2 text-blue-700 font-black text-[10px] uppercase tracking-[2px]">
          <LayoutDashboard size={16} /> Báo cáo tổng hợp - {filterMonth.split('-').reverse().join('/')}
        </span>
        <button className="bg-[#107C41] text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
          <FileSpreadsheet size={16} /> Xuất Excel
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#111827] text-white font-black text-[10px] uppercase">
              <th className="px-6 py-5 border-r border-slate-800">Nhân viên / Đơn vị</th>
              <th className="px-6 py-5 border-r border-slate-800 text-center">Loại đơn</th>
              <th className="px-6 py-5 border-r border-slate-800 text-center">Thời gian</th>
              <th className="px-6 py-5 border-r border-slate-800">Lý do</th>
              <th className="px-6 py-5 border-r border-slate-800 text-center">Người duyệt</th>
              <th className="px-6 py-5 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredList.map((item, idx) => (
              <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-6 py-5 border-r border-slate-50">
                  <div className="font-bold text-slate-900 text-sm">{item.fullName}</div>
                  <div className="text-[10px] text-blue-500 font-black uppercase tracking-tight">
                    {item.company} - {item.departmentName}
                  </div>
                </td>
                <td className="px-6 py-5 border-r border-slate-50 text-center text-xs font-bold text-slate-600">{item.confirmationType}</td>
                <td className="px-6 py-5 border-r border-slate-50 text-center">
                  <div className="text-sm font-bold text-slate-700">{renderDateRange(item.requestDate, item.endDate)}</div>
                  <div className="text-[10px] text-slate-400 font-bold">{item.fromTime} - {item.toTime}</div>
                </td>
                <td className="px-6 py-5 border-r border-slate-50 text-xs text-slate-500 italic max-w-[200px] truncate">"{item.reason}"</td>
                <td className="px-6 py-5 border-r border-slate-50 text-center text-[10px] font-black text-blue-700 uppercase">
                   {item.approvedBy || "---"}
                </td>
                <td className="px-6 py-5 text-center">
                   <span className={`inline-flex items-center gap-1 font-black text-[9px] px-3 py-1.5 rounded-full uppercase border ${item.status === 1 ? 'text-green-700 bg-green-50 border-green-200' : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
                      {item.status === 1 ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                      {item.status === 1 ? "Hoàn tất" : `Chờ ${item.currentApproverRole}`}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Bộ lọc hàng trên: Công ty, Phòng ban, Tháng */}
      {(isReportMode || user?.role?.toUpperCase() === "CHAIRMAN" || user?.deptName?.toUpperCase() === "HCNS") && (
        <div className="flex flex-wrap items-center bg-white p-2.5 rounded-[20px] border border-slate-200 shadow-sm gap-4 animate-in fade-in">
          
          {/* 1. Lọc Công ty */}
          <div className="flex bg-slate-100 p-1 rounded-xl ml-3">
              <button 
                onClick={() => { setFilterCompany(""); setFilterDept(""); }}
                className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${filterCompany === "" ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}
              >
                TẤT CẢ
              </button>
              {["VNEB", "VHS"].map(co => (
                <button 
                  key={co} 
                  onClick={() => { setFilterCompany(co); setFilterDept(""); }}
                  className={`px-5 py-2 rounded-lg text-[10px] font-black transition-all ${filterCompany === co ? 'bg-white shadow-md text-blue-600' : 'text-slate-400'}`}
                >
                  {co}
                </button>
              ))}
          </div>

          {/* 2. Lọc Phòng ban */}
          <select 
            className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-[11px] font-bold text-slate-600 outline-none min-w-[200px]"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>

          {/* 3. Lọc Tháng (Xử lý giao diện) */}
          <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 ml-auto mr-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tháng báo cáo</span>
            <input 
              type="month" 
              className="bg-transparent text-[11px] font-black text-blue-600 outline-none uppercase cursor-pointer"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        filteredList.length > 0 ? (
          isReportMode ? <TableView /> : <CardView />
        ) : (
          <div className="h-64 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-2 animate-in fade-in">
              <ShieldCheck size={40} className="opacity-20" />
              <span className="text-xs italic font-medium">Không tìm thấy dữ liệu trong tháng {filterMonth.split('-').reverse().join('/')}.</span>
          </div>
        )
      )}

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        title={modalConfig.title}
        message={modalConfig.message}
        isLoading={modalConfig.isLoading}
        type={modalConfig.actionType === 'REJECT' ? "danger" : "success"}
        confirmText={modalConfig.actionType === 'REJECT' ? "Xác nhận từ chối" : "Xác nhận duyệt"}
      />
    </div>
  );
}