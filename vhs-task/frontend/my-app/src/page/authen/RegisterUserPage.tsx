"use client";

import React, { useState, useEffect } from "react";
import { UserPlus, Shield, Building, Mail, Lock, User as UserIcon, Loader2, CheckCircle2, LayoutGrid } from "lucide-react";
import { authenApi } from "../authen/authenApi";
import { departmentApi } from "../department/departmentApi";


interface Department {
  id: number;
  name: string;
}

export default function RegisterUserPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    fullName: "",
    email: "",
    role: "STAFF",
    company: "VNEB",
    departmentId: "", // Để trống lúc đầu để bắt buộc chọn
  });

  const [loading, setLoading] = useState(false);
  const [fetchingDepts, setFetchingDepts] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });

  // 1. Fetch danh sách phòng ban khi component mount
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res: any = await departmentApi.getDepartments();
        const deptData = res.data?.data || res.data || [];
        setDepartments(deptData);
        
        if (deptData.length > 0) {
          setFormData(prev => ({ ...prev, departmentId: deptData[0].id.toString() }));
        }
      } catch (err) {
        console.error("Lỗi lấy danh sách phòng ban:", err);
      } finally {
        setFetchingDepts(false);
      }
    };
    fetchDepts();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.departmentId) {
      setMessage({ type: "error", text: "Vui lòng chọn phòng ban" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        ...formData,
        departmentId: parseInt(formData.departmentId)
      };

      const res: any = await authenApi.register(payload);
      if (res.code === 200 || res.status === 200) {
        setMessage({ type: "success", text: "Tạo tài khoản thành công!" });
        setFormData({ ...formData, username: "", password: "", fullName: "", email: "" });
      } else {
        setMessage({ type: "error", text: res.message || "Không thể tạo tài khoản" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.response?.data?.message || "Lỗi máy chủ" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-200">
          <UserPlus size={24} />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Thêm thành viên mới</h1>
          <p className="text-sm text-slate-500 font-medium">Cấp quyền truy cập hệ thống ERP cho nhân sự mới</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        
        {/* Username */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <UserIcon size={12} /> Tên đăng nhập
          </label>
          <input
            name="username" value={formData.username} onChange={handleChange} required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Ví dụ: phuongnv"
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <Lock size={12} /> Mật khẩu ban đầu
          </label>
          <input
            type="password" name="password" value={formData.password} onChange={handleChange} required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="••••••••"
          />
        </div>

        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Họ và tên nhân viên</label>
          <input
            name="fullName" value={formData.fullName} onChange={handleChange} required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="Nguyễn Văn A"
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <Mail size={12} /> Email công việc
          </label>
          <input
            type="email" name="email" value={formData.email} onChange={handleChange} required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            placeholder="nva@vneb.com.vn"
          />
        </div>

        {/* Company */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <Building size={12} /> Công ty trực thuộc
          </label>
          <select
            name="company" value={formData.company} onChange={handleChange}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer"
          >
            <option value="VNEB">Công ty VNEB</option>
            <option value="VHS">Công ty VHS</option>
          </select>
        </div>

        {/* Department - CHỌN TỪ DANH SÁCH LẤY TỪ DB */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <LayoutGrid size={12} /> Phòng ban
          </label>
          <select
            name="departmentId" 
            value={formData.departmentId} 
            onChange={handleChange}
            disabled={fetchingDepts}
            required
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer disabled:opacity-50"
          >
            {fetchingDepts ? (
              <option>Đang tải danh sách...</option>
            ) : (
              <>
                <option value="">-- Chọn phòng ban --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {/* Role */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1 flex items-center gap-1">
            <Shield size={12} /> Phân quyền hệ thống (Role)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            {["STAFF", "MANAGER", "CHAIRMAN", "BOD"].map((r) => (
              <button
                key={r} type="button"
                onClick={() => setFormData({ ...formData, role: r })}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border ${
                  formData.role === r 
                  ? "bg-blue-600 text-white border-blue-600 shadow-md" 
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Thông báo */}
        <div className="md:col-span-2">
          {message.text && (
            <div className={`p-4 rounded-xl flex items-center gap-2 text-sm font-bold uppercase animate-bounce ${
              message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
              : 'bg-red-50 text-red-600 border border-red-100'
            }`}>
              {message.type === 'success' ? <CheckCircle2 size={18} /> : null}
              {message.text}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="md:col-span-2 pt-4">
          <button
            type="submit" disabled={loading || fetchingDepts}
            className="flex items-center justify-center gap-2 w-full md:w-max px-12 py-4 bg-slate-900 text-white rounded-xl font-black text-sm tracking-widest hover:bg-blue-600 transition-all shadow-xl active:scale-95 disabled:bg-slate-300 uppercase"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} />}
            Tạo tài khoản ngay
          </button>
        </div>
      </form>
    </div>
  );
}