"use client";
import React, { useState, useEffect } from "react";
import { 
  Save, Send, Clock, Calendar, FileText, AlertCircle,
  CheckCircle2, Trash2, ShieldCheck, UserCheck, ArrowRight, Plus
} from "lucide-react";
import { leaveApi } from "./LeaveApi";
import SuccessModal from "../../component/SuccessModal";

export default function LeaveRegistrationForm({ user, onSuccess }: any) {
  const [loading, setLoading] = useState(false);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  // Kiểm tra quyền HCNS
  const isHCNSDept = user?.departmentName?.toUpperCase().includes("HCNS") || 
                     user?.departmentName?.toUpperCase().includes("HÀNH CHÍNH") ||
                     user?.role?.toUpperCase() === "ADMIN";

  const [formData, setFormData] = useState({
    confirmationType: "Nghỉ phép",
    requestDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    fromTime: "08:00",
    toTime: "17:30",
    reason: ""
  });

  const loadHistory = async () => {
    try {
      let dataList = [];
      
      if (isHCNSDept) {
        // 1. Nếu là HCNS: Lấy toàn bộ đơn của công ty
        const res: any = await leaveApi.getStatistical();
        if (res.data?.code === 200) {
          // Lọc: Chỉ lấy đơn cá nhân HOẶC những đơn của người khác nhưng đang ở trạng thái CHỜ DUYỆT (status === 0)
          dataList = res.data.data.filter((req: any) => 
            req.userId === user.id || req.status === 0
          );
        }
      } else {
        // 2. Nếu là nhân viên thường: Chỉ lấy đơn của chính mình
        const res: any = await leaveApi.getByUser();
        if (res.data?.code === 200) dataList = res.data.data || [];
      }
      
      setMyRequests(dataList);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { if (user?.id) loadHistory(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reason) return alert("Vui lòng nhập lý do");
    
    if (new Date(formData.requestDate) > new Date(formData.endDate)) {
      return alert("Ngày bắt đầu không được lớn hơn ngày kết thúc");
    }

    setLoading(true);
    try {
      const payload = { ...formData, userId: user.id, status: 0 };
      const res: any = await leaveApi.create(payload);
      
      if (res.data.code === 200) {
        setModalMessage("Đơn đăng ký của bạn đã được gửi thành công.");
        setIsSuccessModalOpen(true);
        setFormData({ ...formData, reason: "" });
        loadHistory();
        if (onSuccess) onSuccess();
      }
    } catch (e) {
      alert("Lỗi khi gửi đơn");
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Bạn muốn hủy đơn này?")) return;
    await leaveApi.delete(id);
    loadHistory();
  };

  return (
    <div className="space-y-6">
      <SuccessModal 
        isOpen={isSuccessModalOpen} 
        onClose={() => setIsSuccessModalOpen(false)}
        message={modalMessage}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form bên trái giữ nguyên */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-[#1F3864] text-white font-black text-xs uppercase tracking-widest flex items-center gap-2">
              <PlusCircle size={16} /> Tạo Đăng Ký Mới
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Loại xác nhận (*)</label>
                <select 
                  value={formData.confirmationType}
                  onChange={(e) => setFormData({...formData, confirmationType: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Nghỉ phép">Nghỉ phép</option>
                  <option value="Nghỉ bù">Nghỉ bù</option>
                  <option value="Nghỉ không lương">Nghỉ không lương</option>
                  <option value="Nghỉ chế độ">Nghỉ chế độ</option>
                  <option value="Đi muộn/Về sớm">Đi muộn/Về sớm</option>
                </select>
              </div>

              <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">
                    {formData.confirmationType === "Đi muộn/Về sớm" ? "Ngày thực hiện" : "Từ ngày"}
                  </label>
                  <input 
                    type="date"
                    value={formData.requestDate}
                    onChange={(e) => setFormData({...formData, requestDate: e.target.value})}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                  />
                </div>
                {formData.confirmationType !== "Đi muộn/Về sớm" && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Đến ngày</label>
                    <input 
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <input type="time" value={formData.fromTime} onChange={(e)=>setFormData({...formData, fromTime:e.target.value})} className="border rounded px-2 py-1 text-sm font-bold"/>
                <input type="time" value={formData.toTime} onChange={(e)=>setFormData({...formData, toTime:e.target.value})} className="border rounded px-2 py-1 text-sm font-bold"/>
              </div>

              <textarea 
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                placeholder="Nhập lý do cụ thể..."
                className="w-full border rounded-lg p-2 text-sm"
              />

              <button type="submit" disabled={loading} className="w-full bg-[#1F3864] text-white py-3 rounded-lg font-black text-xs uppercase">
                {loading ? "Đang gửi..." : "Gửi Đơn Đăng Ký"}
              </button>
            </form>
          </div>
        </div>

        {/* Danh sách bên phải */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <Clock size={16} /> {isHCNSDept ? "Đơn chờ duyệt toàn công ty" : "Lịch sử đăng ký"}
              </h3>
              {isHCNSDept && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Chế độ HCNS</span>}
            </div>
            
            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {myRequests.map((req) => (
                <div key={req.id} className="p-4 hover:bg-slate-50 transition flex justify-between items-center border-l-4 border-transparent hover:border-blue-500">
                  <div className="flex gap-4 items-start">
                    <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                      <Calendar size={20} />
                    </div>
                    <div>
                      {/* Hiển thị tên nếu là đơn của người khác (dành cho HCNS xem) */}
                      {isHCNSDept && req.userId !== user.id && (
                         <div className="text-[10px] font-black text-orange-600 mb-1">NV: {req.fullName || "N/A"}</div>
                      )}
                      <div className="text-sm font-black text-[#1F3864] uppercase">{req.confirmationType}</div>
                      <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                        <span className="text-blue-600">{formatDate(req.requestDate)}</span>
                        <ArrowRight size={10} />
                        <span className="text-blue-600">{formatDate(req.endDate)}</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 italic">"{req.reason}"</div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {req.status === 1 ? (
                      <span className="text-[9px] font-black text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100 uppercase">
                        <CheckCircle2 size={12}/> Đã duyệt
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 uppercase animate-pulse">
                          <AlertCircle size={12}/> {req.userId === user.id ? "Chờ duyệt" : "Mới gửi"}
                        </span>
                        {req.userId === user.id && (
                          <button onClick={() => handleDelete(req.id)} className="text-red-400 p-1 hover:bg-red-50 rounded">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlusCircle({ size }: { size: number }) {
  return <Plus size={size} />;
}