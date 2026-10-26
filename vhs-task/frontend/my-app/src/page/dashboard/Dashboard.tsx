"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import {
  Target,
  Zap,
  ShieldAlert,
  Building2,
  Loader2,
  LayoutDashboard,
  Calendar,
  User,
  Users,
} from "lucide-react";
import { useAppContext } from "../../app/context/AppProvider";
import { dashboardApi } from "./dashboardApi";

interface DashboardProps {
  targetDeptId?: string;
  title?: string; // Đây là tên phòng ban nhận từ Menu khi click
}

export default function PersonalEmployeeDashboard({
  targetDeptId,
  title,
}: DashboardProps) {
  const { user } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [employees, setEmployees] = useState<
    { id: string; fullName: string }[]
  >([]);

  const displayDeptName = useMemo(() => {
    if (title && title !== "Báo cáo tổng hợp") return title; // Nếu title truyền vào hợp lệ
    if (user?.deptName) return user.deptName;
    return "Báo cáo tổng hợp";
  }, [title, user?.deptName]);

  const [filter, setFilter] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      userId: "",
      fromDate: formatDate(firstDay),
      toDate: formatDate(lastDay),
    };
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      if (targetDeptId) {
        try {
          const res = await dashboardApi.getUsersByDept(targetDeptId);
          if (res && res.code === 200) {
            setEmployees(res.data);
          }
        } catch (error) {
          console.error("Lỗi khi lấy danh sách nhân viên:", error);
        }
      }
    };
    fetchEmployees();
  }, [targetDeptId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const idToQuery = targetDeptId ? filter.userId : user?.id;

      const res = await dashboardApi.getPersonalStats(
        idToQuery || "",
        filter.fromDate,
        filter.toDate,
        targetDeptId,
      );

      if (res && res.data.code === 200) {
        setData(res.data.data);
      } else {
        setData(null);
      }
    } catch (error) {
      console.error("Lỗi fetch:", error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id || targetDeptId) {
      fetchDashboardData();
    }
  }, [targetDeptId, filter, user?.id]);

  const calculatePercent = (value: number, total: number) => {
    if (!total || total === 0) return "0.0";
    return ((value / total) * 100).toFixed(1);
  };

  const kpiChartData = [
    {
      name: "Hoàn thành (≥100%)",
      value: data?.sectionKPI?.completedOnTime || 0,
      color: "#10b981",
    },
    {
      name: "Cần cố gắng (70-99%)",
      value: data?.sectionKPI?.completedEffort || 0,
      color: "#3b82f6",
    },
    {
      name: "Cảnh báo (30-69%)",
      value: data?.sectionKPI?.completedWarning || 0,
      color: "#f59e0b",
    },
    {
      name: "Không đáp ứng (<30%)",
      value: data?.sectionKPI?.notMet || 0,
      color: "#ef4444",
    },
  ];

  const totalKPI = data?.sectionKPI?.totalRegistered || 0;

  const renderProgressRow = (emp: any) => {
    const completed = emp.completed || 0;
    const total = emp.total || 0;
    const pending = total - completed;
    const percent = total > 0 ? (completed / total) * 100 : 0;

    return (
      <tr key={emp.id} className="border-b hover:bg-slate-50 transition-colors">
        <td className="p-4 font-bold text-slate-700">{emp.fullName}</td>
        <td className="p-4 text-center font-medium">{total}</td>
        <td className="p-4 text-center text-emerald-600 font-bold">
          {completed}
        </td>
        <td className="p-4 text-center">
          {pending > 0 ? (
            <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-[10px] font-black uppercase">
              Còn {pending} việc
            </span>
          ) : (
            <span className="text-slate-400 font-bold text-[10px] uppercase italic">
              Đã hoàn thành
            </span>
          )}
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percent === 100 ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 w-8 text-right">
              {percent.toFixed(0)}%
            </span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 pb-4 border-b border-slate-100">
    <div className="flex items-center gap-2">
          <LayoutDashboard className="text-blue-600" size={20} />
          <h2 className="text-[20px] font-black text-slate-500 uppercase ">
            Báo cáo Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="text-slate-700" size={24} />
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">
            {displayDeptName}
          </h1>
        </div>
      </div>

      {/* --- BỘ LỌC DỮ LIỆU --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <User size={12} />{" "}
            {targetDeptId ? "Lọc theo nhân viên" : "Nhân viên"}
          </label>
          {targetDeptId ? (
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-52 bg-white font-medium"
              value={filter.userId}
              onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
            >
              <option value="">-- Tất cả nhân viên --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="border border-slate-100 bg-slate-50 rounded-lg px-3 py-2 text-sm w-52 text-slate-600 font-bold flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>{" "}
              {user?.name || "Người dùng"}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar size={12} /> Từ ngày
          </label>
          <input
            type="date"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filter.fromDate}
            onChange={(e) => setFilter({ ...filter, fromDate: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
            <Calendar size={12} /> Đến ngày
          </label>
          <input
            type="date"
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={filter.toDate}
            onChange={(e) => setFilter({ ...filter, toDate: e.target.value })}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] items-center justify-center flex-col gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            Đang tải dữ liệu...
          </p>
        </div>
      ) : !data || totalKPI === 0 ? (
        <div className="p-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
          <LayoutDashboard className="mx-auto text-slate-300 mb-4" size={48} />
          <p className="text-slate-500 font-bold uppercase text-xs">
            Không tìm thấy dữ liệu đánh giá cho mục này
          </p>
        </div>
      ) : (
        <>
          {/* DASHBOARD CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Tổng việc
              </p>
              <p className="text-3xl font-black text-slate-800 mt-1">
                {totalKPI}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Hoàn thành
              </p>
              <p className="text-3xl font-black text-emerald-600 mt-1">
                {data?.sectionKPI?.completedOnTime || 0}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Cố gắng
              </p>
              <p className="text-3xl font-black text-blue-600 mt-1">
                {data?.sectionKPI?.completedEffort || 0}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-orange-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Cảnh báo
              </p>
              <p className="text-3xl font-black text-orange-500 mt-1">
                {data?.sectionKPI?.completedWarning || 0}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Không đạt
              </p>
              <p className="text-3xl font-black text-red-500 mt-1">
                {data?.sectionKPI?.notMet || 0}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-800 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="text-emerald-400" size={20} />
                  <h3 className="text-white font-bold text-sm uppercase">
                    I. Chỉ số hoàn thành KPI
                  </h3>
                </div>
              </div>
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-[11px] uppercase text-slate-500 font-bold border-b">
                    <th className="p-4">Hạng mục đánh giá</th>
                    <th className="p-4 text-center">Số lượng</th>
                    <th className="p-4 text-center">Tỉ trọng</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-emerald-50/30 font-bold text-emerald-800">
                    <td className="p-4">1. Hoàn thành nhiệm vụ (≥100%)</td>
                    <td className="p-4 text-center">
                      {data?.sectionKPI?.completedOnTime || 0}
                    </td>
                    <td className="p-4 text-center">
                      {calculatePercent(
                        data?.sectionKPI?.completedOnTime,
                        totalKPI,
                      )}
                      %
                    </td>
                  </tr>
                  <tr className="border-b bg-blue-50/30 font-bold text-blue-700">
                    <td className="p-4">2. Cần cố gắng (70-99%)</td>
                    <td className="p-4 text-center">
                      {data?.sectionKPI?.completedEffort || 0}
                    </td>
                    <td className="p-4 text-center">
                      {calculatePercent(
                        data?.sectionKPI?.completedEffort,
                        totalKPI,
                      )}
                      %
                    </td>
                  </tr>
                  <tr className="border-b bg-orange-50/30 font-bold text-orange-700">
                    <td className="p-4">3. Cảnh báo (30-69%)</td>
                    <td className="p-4 text-center">
                      {data?.sectionKPI?.completedWarning || 0}
                    </td>
                    <td className="p-4 text-center">
                      {calculatePercent(
                        data?.sectionKPI?.completedWarning,
                        totalKPI,
                      )}
                      %
                    </td>
                  </tr>
                  <tr className="bg-red-50/30 font-bold text-red-700">
                    <td className="p-4">4. Không đáp ứng CV (&lt;30%)</td>
                    <td className="p-4 text-center">
                      {data?.sectionKPI?.notMet || 0}
                    </td>
                    <td className="p-4 text-center">
                      {calculatePercent(data?.sectionKPI?.notMet, totalKPI)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
              <h3 className="font-bold text-slate-700 mb-4 uppercase text-[10px] tracking-widest">
                Phân bổ kết quả thực hiện
              </h3>
              <div className="h-[220px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kpiChartData.filter((i) => i.value > 0)}
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {kpiChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <text
                      x="50%"
                      y="50%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x="50%"
                        dy="-0.5em"
                        className="fill-slate-400 font-bold text-[10px] uppercase"
                      >
                        Hoàn thành
                      </tspan>
                      <tspan
                        x="50%"
                        dy="1.5em"
                        className="fill-red-600 font-black text-xl "
                      >
                        {calculatePercent(
                          data?.sectionKPI?.completedOnTime,
                          totalKPI,
                        )}
                        %
                      </tspan>
                    </text>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 space-y-2.5 w-full">
                {kpiChartData.map((item) => (
                  <div
                    key={item.name}
                    className="flex justify-between items-center text-[10px] font-bold uppercase"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm"
                        style={{ backgroundColor: item.color }}
                      ></span>
                      <span className="text-slate-500">{item.name}</span>
                    </span>
                    <span className="text-slate-800">
                      {item.value} việc (
                      {calculatePercent(item.value, totalKPI)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-2 border-l-4 border-red-600 pl-4">
              <Users className="text-red-600" size={20} />
              <h2 className="font-bold text-slate-700 uppercase text-sm">
                {targetDeptId
                  ? "Theo dõi tiến độ nhân viên (Việc chưa xong)"
                  : "Tiến độ công việc của tôi"}
              </h2>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 font-bold text-[10px] uppercase text-slate-500 border-b">
                    <th className="p-4">
                      {targetDeptId ? "Nhân viên" : "Hồ sơ"}
                    </th>
                    <th className="p-4 text-center">Tổng việc</th>
                    <th className="p-4 text-center text-emerald-600">
                      Đã xong
                    </th>
                    <th className="p-4 text-center text-red-600">Còn lại</th>
                    <th className="p-4 w-1/3 text-center">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {targetDeptId && !filter.userId
                    ? data?.employeeList?.map((emp: any) =>
                        renderProgressRow(emp),
                      )
                    : renderProgressRow({
                        id: filter.userId || user?.id,
                        fullName:
                          employees.find((e) => e.id === filter.userId)
                            ?.fullName ||
                          user?.name ||
                          "Nhân viên",
                        total: data?.sectionKPI?.totalRegistered || 0,
                        completed: data?.sectionKPI?.completedOnTime || 0,
                      })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-blue-600 pl-4">
                <Zap className="text-blue-600" size={20} />
                <h2 className="font-bold text-slate-700 uppercase text-sm">
                  II. Độ phức tạp công việc
                </h2>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-slate-50 font-bold text-[10px] uppercase text-slate-500">
                      <th className="p-4">Độ khó</th>
                      <th className="p-4 text-center">Số lượng</th>
                      <th className="p-4 text-center">Tỉ lệ đạt</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 italic text-slate-600">
                        Phức tạp Cao
                      </td>
                      <td className="p-4 text-center font-bold">
                        {data?.sectionComplexity?.counts?.high || 0}
                      </td>
                      <td className="p-4 text-center font-black text-blue-600">
                        {data?.sectionComplexity?.completionRates?.highRate ||
                          0}
                        %
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 italic text-slate-600">Trung bình</td>
                      <td className="p-4 text-center font-bold">
                        {data?.sectionComplexity?.counts?.medium || 0}
                      </td>
                      <td className="p-4 text-center font-black text-blue-600">
                        {data?.sectionComplexity?.completionRates?.mediumRate ||
                          0}
                        %
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 italic text-slate-600">Thấp</td>
                      <td className="p-4 text-center font-bold">
                        {data?.sectionComplexity?.counts?.low || 0}
                      </td>
                      <td className="p-4 text-center font-black text-blue-600">
                        {data?.sectionComplexity?.completionRates?.lowRate || 0}
                        %
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 border-l-4 border-orange-500 pl-4">
                <ShieldAlert className="text-orange-600" size={20} />
                <h2 className="font-bold text-slate-700 uppercase text-sm">
                  III. Mức độ ưu tiên
                </h2>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-sm">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b bg-slate-50 font-bold text-[10px] uppercase text-slate-500">
                      <th className="p-4">Độ ưu tiên</th>
                      <th className="p-4 text-center">Tỉ lệ hoàn thành</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 italic text-slate-600">
                        Ưu tiên Cao (Gấp)
                      </td>
                      <td className="p-4 text-center font-black text-orange-600">
                        {data?.sectionPriority?.highPriorityRate || 0}%
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-slate-50 transition-colors">
                      <td className="p-4 italic text-slate-600">
                        Ưu tiên Trung bình
                      </td>
                      <td className="p-4 text-center font-black text-orange-600">
                        {data?.sectionPriority?.mediumPriorityRate || 0}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-4 italic text-slate-600">
                        Ưu tiên Thấp
                      </td>
                      <td className="p-4 text-center font-black text-orange-600">
                        {data?.sectionPriority?.lowPriorityRate || 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
