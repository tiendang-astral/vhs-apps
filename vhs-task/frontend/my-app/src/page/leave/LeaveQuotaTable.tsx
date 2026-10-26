import React, { useState, useEffect, useMemo } from "react";
import { leaveApi } from "./LeaveApi";
import { authenApi } from "../authen/authenApi";
import { Filter, Search, Building2, Users } from "lucide-react";

export default function LeaveQuotaTable({ user }: any) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // State cho bộ lọc
  const [filterCompany, setFilterCompany] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, quotaRes] = await Promise.all([
        authenApi.getAllUsers(),
        leaveApi.getQuotaReport(""),
      ]);

      const allUsers = userRes.data?.data || [];
      const quotaData = quotaRes.data?.data || [];

      const mergedData = allUsers.map((u: any) => {
        const quota = quotaData.find(
          (q: any) =>
            String(q.userId).toLowerCase() === String(u.id).toLowerCase(),
        );

        const rLastYear = quota?.remainingLastYear || 0;
        const nQuota = quota?.newQuota || 0;
        const uPaidLeave = quota?.usedPaidLeave || 0;
        const tQuota = rLastYear + nQuota;

        return {
          userId: u.id,
          fullName: u.fullName,
          departmentName: u.department?.name || "Chưa xếp phòng",
          company: u.company || "N/A",
          remainingLastYear: rLastYear,
          newQuota: nQuota,
          totalQuota: tQuota,
          usedPaidLeave: uPaidLeave, 
          // Công thức: Tổng Quỹ - Đã nghỉ
          remainingQuota: tQuota - uPaidLeave,
          specialLeave: quota?.specialLeave || 0,
          lateEarlyCount: quota?.lateEarlyCount || 0,
          unpaidLeave: quota?.unpaidLeave || 0,
        };
      });
      setData(mergedData);
    } catch (error) {
      console.error("Lỗi load data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchCompany =
        filterCompany === "" || item.company === filterCompany;
      const matchDept =
        filterDept === "" || item.departmentName.includes(filterDept);
      const matchSearch = item.fullName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchCompany && matchDept && matchSearch;
    });
  }, [data, filterCompany, filterDept, searchTerm]);

  const companies = useMemo(
    () => Array.from(new Set(data.map((d) => d.company))),
    [data],
  );
  const departments = useMemo(
    () => Array.from(new Set(data.map((d) => d.departmentName))),
    [data],
  );

  const handleUpdate = async (item: any) => {
    try {
      await leaveApi.updateQuota({
        userId: item.userId,
        remainingLastYear: item.remainingLastYear,
        newQuota: item.newQuota,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const updateLocalValue = (idx: number, field: string, val: string) => {
    const num = parseFloat(val) || 0;
    const newData = [...data];
    const itemIdx = data.findIndex(
      (d) => d.userId === filteredData[idx].userId,
    );
    if (itemIdx > -1) {
      const updatedItem = { ...newData[itemIdx], [field]: num };
      
      // Tính toán lại các giá trị phụ thuộc khi thay đổi Tồn hoặc Cấp mới
      const newTotal = updatedItem.remainingLastYear + updatedItem.newQuota;
      updatedItem.totalQuota = newTotal;
      updatedItem.remainingQuota = newTotal - updatedItem.usedPaidLeave;

      newData[itemIdx] = updatedItem;
      setData(newData);
    }
  };

  return (
    <div className="space-y-4">
      {/* THANH BỘ LỌC */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm tên nhân viên..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-xs shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="relative">
          <Building2 className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <select
            className="w-full pl-10 pr-4 py-2 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-xs shadow-sm appearance-none bg-white"
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
          >
            <option value="">Tất cả công ty</option>
            {companies.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>

        <div className="relative">
          <Users className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <select
            className="w-full pl-10 pr-4 py-2 rounded-xl border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 text-xs shadow-sm appearance-none bg-white"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
        </div>

        <div className="flex items-center justify-end text-slate-400 text-[10px] font-bold uppercase tracking-wider">
          Tổng số: {filteredData.length} nhân sự
        </div>
      </div>

      {/* BẢNG DỮ LIỆU */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xl">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-slate-900 text-white uppercase tracking-wider">
              <th className="p-4 text-left font-black">Nhân viên / Phòng ban</th>
              <th className="p-4 text-center bg-slate-800">Tồn ({new Date().getFullYear() - 1})</th>
              <th className="p-4 text-center bg-slate-800">Cấp mới</th>
              <th className="p-4 text-center text-blue-400 font-black">Tổng Quỹ</th>
              <th className="p-4 text-center text-green-400">Đã nghỉ</th>
              {/* CỘT MỚI THÊM */}
              <th className="p-4 text-center text-yellow-500 font-black bg-slate-800/50">Phép còn lại</th>
              <th className="p-4 text-center text-purple-400">Chế độ</th>
              <th className="p-4 text-center text-orange-400">Sớm/Muộn</th>
              <th className="p-4 text-center text-red-400">Không lương</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="p-20 text-center text-slate-400 animate-pulse font-bold">
                  Đang truy xuất dữ liệu hệ thống...
                </td>
              </tr>
            ) : (
              filteredData.map((item, idx) => (
                <tr key={item.userId} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{item.fullName}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{item.company}</span>
                      <span className="text-[9px] text-slate-400 uppercase font-medium">{item.departmentName}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={item.remainingLastYear}
                      onChange={(e) => updateLocalValue(idx, "remainingLastYear", e.target.value)}
                      onBlur={() => handleUpdate(item)}
                      className="w-12 text-center py-1 rounded-md border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <input
                      type="number"
                      value={item.newQuota}
                      onChange={(e) => updateLocalValue(idx, "newQuota", e.target.value)}
                      onBlur={() => handleUpdate(item)}
                      className="w-12 text-center py-1 rounded-md border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                    />
                  </td>
                  <td className="p-4 text-center font-black text-blue-600 bg-blue-50/20">{item.totalQuota}</td>
                  <td className="p-4 text-center text-green-600 font-bold">{item.usedPaidLeave}</td>
                  
                  {/* HIỂN THỊ PHÉP CÒN LẠI */}
                  <td className="p-4 text-center font-black text-yellow-600 bg-yellow-50/30">
                    {item.remainingQuota}
                  </td>

                  <td className="p-4 text-center text-purple-600 font-bold">{item.specialLeave}</td>
                  <td className="p-4 text-center text-orange-600 font-bold">{item.lateEarlyCount}</td>
                  <td className="p-4 text-center text-red-500 font-bold">{item.unpaidLeave}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}