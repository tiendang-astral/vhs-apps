import React, { useState } from "react";
import { useAppContext } from "../../app/context/AppProvider";
import { authenApi } from "../authen/authenApi"; 
import Swal from "sweetalert2";
import { KeyRound, Lock, ShieldCheck, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";

function ChangePasswordPage() {
  const { user, setUser } = useAppContext();
  const [form, setForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.oldPassword || !form.newPassword) {
      Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập đầy đủ các trường!', confirmButtonColor: '#2563eb' });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Mật khẩu không khớp', text: 'Xác nhận mật khẩu mới không chính xác!', confirmButtonColor: '#2563eb' });
      return;
    }

    setLoading(true);
    try {
      // Sửa lỗi truyền đối số ở đây (bọc vào 1 object)
      const res = await authenApi.changePassword({
        userId: user?.id || "",
        oldPassword: form.oldPassword,
        newPassword: form.newPassword
      });

      if (res.data.code === 200) {
        await Swal.fire({
          icon: 'success',
          title: 'Thành công!',
          text: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.',
          confirmButtonColor: '#2563eb'
        });
        localStorage.clear();
        setUser(null);
      } else {
        Swal.fire({ icon: 'error', title: 'Thất bại', text: res.data.message || "Lỗi không xác định" });
      }
    } catch (error: any) {
      // Hiển thị đúng lý do từ server (sai mật khẩu cũ, mật khẩu mới chưa đủ mạnh...)
      const serverMsg = error?.response?.data?.message;
      Swal.fire({ icon: 'error', title: 'Lỗi', text: serverMsg || 'Mật khẩu cũ không đúng hoặc server mất kết nối!' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="max-w-md w-full bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
        {/* Trang trí phía sau */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 z-0"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200 rotate-3">
              <KeyRound size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800">Cài đặt mật khẩu</h2>
            <p className="text-slate-400 text-sm font-medium mt-2">Bảo mật tài khoản của bạn</p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">Mật khẩu hiện tại</label>
              <input 
                type="password" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold"
                placeholder="Nhập mật khẩu đang dùng"
                onChange={(e) => setForm({...form, oldPassword: e.target.value})}
              />
            </div>

            <div className="h-[1px] bg-slate-100 my-2"></div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">Mật khẩu mới</label>
              <input 
                type="password" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold"
                placeholder="Tối thiểu 6 ký tự"
                onChange={(e) => setForm({...form, newPassword: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 ml-1 tracking-widest">Xác nhận mật khẩu</label>
              <input 
                type="password" 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 focus:bg-white outline-none transition-all text-sm font-bold"
                placeholder="Nhập lại mật khẩu mới"
                onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
              />
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full mt-6 bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:bg-blue-600 transition-all shadow-xl hover:shadow-blue-200 flex items-center justify-center gap-3 ${loading ? "opacity-50" : ""}`}
            >
              {loading ? "Đang xử lý..." : "Xác nhận thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChangePasswordPage;