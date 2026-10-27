"use client";

import React, { useState } from "react";
import { useAppContext } from "../../app/context/AppProvider";
import { jwtDecode } from "jwt-decode";
import { authenApi } from "./authenApi";

export default function LoginPage() {
  const { setUser } = useAppContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response: any = await authenApi.login({ username, password });
      const res = response.data; 

      if (res && res.data && res.data.token) {
        const userData = res.data;
        const token = userData.token;

        const decoded: any = jwtDecode(token);
        const userIdFromToken = decoded["nameid"] || decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"];

        // 1. LƯU ĐẦY ĐỦ VÀO LOCALSTORAGE (Để App.tsx đọc được sau khi F5)
        localStorage.setItem("accessToken", token);
        localStorage.setItem("userId", userIdFromToken);
        localStorage.setItem("username", userData.username); // Dòng này sửa lỗi kẹt login
        localStorage.setItem("role", userData.role); 
        localStorage.setItem("fullName", userData.fullName);
        localStorage.setItem("company", userData.company || "VNEB");
        localStorage.setItem("departmentId", userData.departmentId?.toString() || "");
localStorage.setItem("departmentName", userData.deptName);
        // 2. CẬP NHẬT CONTEXT (Để chuyển trang ngay lập tức)
        setUser({
          id: userIdFromToken,
          name: userData.fullName,
          username: userData.username,
          role: userData.role,
          company: userData.company || "VNEB",
          deptId: userData.departmentId?.toString() || "",
          deptName: localStorage.getItem('departmentName') || ''
        });

        // KHÔNG dùng window.location.href để tránh reload làm mất state mượt mà của React
      } else {
        setError(res?.message || "Tên đăng nhập hoặc mật khẩu sai");
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("Bạn đã thử đăng nhập quá nhiều lần. Vui lòng đợi 1 phút rồi thử lại.");
      } else {
        setError(err.response?.data?.message || "Lỗi kết nối server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg">V</div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Daily Work tasks</h2>
          <p className="text-slate-400 text-sm font-medium">Vui lòng đăng nhập để tiếp tục</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="text-red-600 text-xs p-3 bg-red-50 border border-red-100 rounded-lg animate-pulse font-medium">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Tài khoản</label>
            <input 
              type="text" placeholder="Nhập username..." 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={username} onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Mật khẩu</label>
            <input 
              type="password" placeholder="••••••••" 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={password} onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-200 disabled:bg-slate-300 disabled:shadow-none mt-4"
          >
            {loading ? "ĐANG XỬ LÝ..." : "ĐĂNG NHẬP"}
          </button>
        </form>
      </div>
    </div>
  );
}