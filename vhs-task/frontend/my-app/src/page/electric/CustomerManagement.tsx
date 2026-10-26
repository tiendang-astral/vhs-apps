"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, FileSpreadsheet } from "lucide-react";
import { customerApi } from "./CustomerApi";
import ConfirmModal from "../../component/ConfirmModal";
import SuccessModal from "../../component/SuccessModal";

interface Customer {
  id: string;
  province: string;
  industrialZone: string;
  customerName: string;
  address: string;
  contractSigningDate: string;
  contractExpiryDate: string;
  taxCode: string;
  bankAccountNumber: string;
  email: string;
  phone: string;
  usageLocation: string;
  connectionPoint: string;
  usagePurpose: string;
  voltageLevel: string;
  maxPower: string;
  avgDailyPower: string;
  minPower: string;
  registeredVolume: string;
  legalDocuments: string;
}

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  // State quản lý lỗi validation
  const [errors, setErrors] = useState<{ id?: string }>({});

  const [formData, setFormData] = useState<Customer>({
    id: "",
    province: "",
    industrialZone: "",
    customerName: "",
    address: "",
    contractSigningDate: "",
    contractExpiryDate: "",
    taxCode: "",
    bankAccountNumber: "",
    email: "",
    phone: "",
    usageLocation: "",
    connectionPoint: "",
    usagePurpose: "",
    voltageLevel: "",
    maxPower: "",
    avgDailyPower: "",
    minPower: "",
    registeredVolume: "",
    legalDocuments: "",
  });

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getAll();
      setCustomers(res.data);
    } catch (error) {
      console.error("Lỗi khi tải danh sách khách hàng:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSave = async () => {
    // Logic Require Mã khách hàng
    if (!formData.id || formData.id.trim() === "") {
      setErrors({ id: "Mã khách hàng không được để trống" });
      return;
    }

    try {
      if (editingId) {
        await customerApi.update(editingId, formData);
        setSuccessMessage("Thông tin khách hàng đã được cập nhật.");
      } else {
        await customerApi.create(formData);
        setSuccessMessage("Khách hàng mới đã được thêm vào hệ thống.");
      }
      await fetchCustomers();
      setIsModalOpen(false);
      setIsSuccessModalOpen(true);
      setErrors({});
    } catch (error) {
      console.error(error);
    }
  };

  const openModal = (customer?: Customer) => {
    setErrors({});
    if (customer) {
      setFormData(customer);
      setEditingId(customer.id);
    } else {
      setFormData({
        id: "",
        province: "",
        industrialZone: "",
        customerName: "",
        address: "",
        contractSigningDate: "",
        contractExpiryDate: "",
        taxCode: "",
        bankAccountNumber: "",
        email: "",
        phone: "",
        usageLocation: "",
        connectionPoint: "",
        usagePurpose: "",
        voltageLevel: "",
        maxPower: "",
        avgDailyPower: "",
        minPower: "",
        registeredVolume: "",
        legalDocuments: "",
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setItemToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      setLoading(true);
      try {
        await customerApi.delete(itemToDelete);
        setSuccessMessage("Khách hàng đã được xóa khỏi hệ thống.");
        setIsDeleteModalOpen(false);
        await fetchCustomers();
        setIsSuccessModalOpen(true);
      } catch (error) {
        console.error("Lỗi khi xóa:", error);
        alert("Xảy ra lỗi khi xóa dữ liệu, vui lòng thử lại.");
      } finally {
        setLoading(false);
        setItemToDelete(null);
      }
    }
  };

  return (
    <div className="space-y-4 p-4 bg-slate-50 min-h-screen font-sans">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-[#1e3a5f] uppercase tracking-tight">
            Quản lý thông tin khách hàng
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Hệ thống quản lý hồ sơ và thông số kỹ thuật điện
          </p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold uppercase shadow-sm">
            <FileSpreadsheet size={16} /> Xuất dữ liệu
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all text-xs font-bold uppercase shadow-sm"
          >
            <Plus size={16} /> Thêm khách hàng
          </button>
        </div>
      </div>

      {/* Table Area */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse min-w-[2500px]">
            <thead className="bg-[#1e3a5f] text-white uppercase">
              <tr>
                <th className="px-3 py-4 border border-slate-600 text-center sticky left-0 bg-[#1e3a5f]">
                  TT
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center sticky left-10 bg-[#1e3a5f]">
                  Mã khách hàng
                </th>
                <th className="px-3 py-4 border border-slate-600">Tỉnh</th>
                <th className="px-3 py-4 border border-slate-600">KCN/CCN</th>
                <th className="px-3 py-4 border border-slate-600 w-64">
                  Tên khách hàng
                </th>
                <th className="px-3 py-4 border border-slate-600 w-64">
                  Địa chỉ
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Ngày ký HĐ
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Thời hạn HĐ
                </th>
                <th className="px-3 py-4 border border-slate-600">
                  Mã số thuế
                </th>
                <th className="px-3 py-4 border border-slate-600">
                  Số tài khoản
                </th>
                <th className="px-3 py-4 border border-slate-600">Email</th>
                <th className="px-3 py-4 border border-slate-600">
                  Điện thoại
                </th>
                <th className="px-3 py-4 border border-slate-600">
                  Địa điểm sử dụng điện
                </th>
                <th className="px-3 py-4 border border-slate-600">
                  Điểm đấu nối cấp điện
                </th>
                <th className="px-3 py-4 border border-slate-600">
                  Mục đích sử dụng điện
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Cấp điện áp(kV)
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Công suất cực đại(kW)
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Công suất sử dụng TB ngày(kW)
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Công suất nhỏ nhất(kW)
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Sản lượng điện đăng ký TB tháng(kWh)
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center">
                  Hồ sơ pháp lý
                </th>
                <th className="px-3 py-4 border border-slate-600 text-center sticky right-0 bg-[#1e3a5f]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={22}
                    className="text-center py-10 text-slate-400 font-bold"
                  >
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : (
                customers.map((c, index) => (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                  >
                    <td className="px-3 py-3 text-center border sticky left-0 bg-white">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3 text-center border font-bold text-rose-600 sticky left-10 bg-white">
                      {c.id}
                    </td>
                    <td className="px-3 py-3 border">{c.province}</td>
                    <td className="px-3 py-3 border">{c.industrialZone}</td>
                    <td className="px-3 py-3 border font-bold text-slate-900">
                      {c.customerName}
                    </td>
                    <td className="px-3 py-3 border text-[10px] leading-tight text-slate-500">
                      {c.address}
                    </td>
                    <td className="px-3 py-3 border text-center">
                      {c.contractSigningDate?.split("T")[0]}
                    </td>
                    <td className="px-3 py-3 border text-center">
                      {c.contractExpiryDate}
                    </td>
                    <td className="px-3 py-3 border font-mono">{c.taxCode}</td>
                    <td className="px-3 py-3 border text-[10px]">
                      {c.bankAccountNumber}
                    </td>
                    <td className="px-3 py-3 border text-blue-600">
                      {c.email}
                    </td>
                    <td className="px-3 py-3 border font-bold">{c.phone}</td>
                    <td className="px-3 py-3 border text-slate-500">
                      {c.usageLocation}
                    </td>
                    <td className="px-3 py-3 border">{c.connectionPoint}</td>
                    <td className="px-3 py-3 border">{c.usagePurpose}</td>
                    <td className="px-3 py-3 border text-center font-bold">
                      {c.voltageLevel}
                    </td>
                    <td className="px-3 py-3 border text-center text-rose-600 font-bold">
                      {c.maxPower}
                    </td>
                    <td className="px-3 py-3 border text-center">
                      {c.avgDailyPower}
                    </td>
                    <td className="px-3 py-3 border text-center">
                      {c.minPower}
                    </td>
                    <td className="px-3 py-3 border text-center font-mono">
                      {c.registeredVolume}
                    </td>
                    <td className="px-3 py-3 border text-center text-blue-500 underline cursor-pointer italic">
                      {c.legalDocuments}
                    </td>
                    <td className="px-3 py-3 border text-center sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => openModal(c)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => confirmDelete(c.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-100">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
              <h2 className="font-black text-[#1e3a5f] uppercase tracking-wide">
                {editingId ? "Cập nhật" : "Thêm mới"} khách hàng
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Mã khách hàng (Require) */}
              <div className="md:col-span-1 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Mã khách hàng <span className="text-rose-500">*</span>
                  {editingId && (
                    <span className="text-slate-400"> (Không thể sửa)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.id}
                  onChange={(e) => {
                    setFormData({ ...formData, id: e.target.value });
                    if (e.target.value) setErrors({});
                  }}
                  disabled={!!editingId}
                  placeholder="VD: KH001"
                  className={`w-full px-3 py-2 border rounded-lg font-bold transition-all ${
                    editingId
                      ? "bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200"
                      : errors.id
                        ? "border-rose-500 bg-rose-50 text-rose-600 outline-none"
                        : "text-rose-600 border-slate-300 focus:border-rose-500 outline-none"
                  }`}
                />
                {errors.id && !editingId && (
                  <p className="text-[9px] text-rose-500 font-bold uppercase mt-1">
                    {errors.id}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Tỉnh
                </label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) =>
                    setFormData({ ...formData, province: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  KCN/CCN
                </label>
                <input
                  type="text"
                  value={formData.industrialZone}
                  onChange={(e) =>
                    setFormData({ ...formData, industrialZone: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Mã số thuế
                </label>
                <input
                  type="text"
                  value={formData.taxCode}
                  onChange={(e) =>
                    setFormData({ ...formData, taxCode: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg font-mono"
                />
              </div>

              {/* BỔ SUNG: Số tài khoản */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Số tài khoản
                </label>
                <input
                  type="text"
                  value={formData.bankAccountNumber}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bankAccountNumber: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Tên Khách Hàng
                </label>
                <input
                  type="text"
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData({ ...formData, customerName: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                />
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Ngày ký HĐ
                </label>
                <input
                  type="date"
                  value={formData.contractSigningDate?.split("T")[0]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contractSigningDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Thời hạn HĐ
                </label>
                <input
                  type="text"
                  value={formData.contractExpiryDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      contractExpiryDate: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Điện thoại
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-600 uppercase">
                    Địa điểm sử dụng điện
                  </label>
                  <input
                    type="text"
                    value={formData.usageLocation}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        usageLocation: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-blue-50/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-600 uppercase">
                    Điểm đấu nối
                  </label>
                  <input
                    type="text"
                    value={formData.connectionPoint}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        connectionPoint: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-blue-50/30"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-blue-600 uppercase">
                    Mục đích SD điện
                  </label>
                  <input
                    type="text"
                    value={formData.usagePurpose}
                    onChange={(e) =>
                      setFormData({ ...formData, usagePurpose: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-blue-50/30"
                  />
                </div>
              </div>

              <div className="md:col-span-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Cấp áp (kV)
                  </label>
                  <input
                    type="text"
                    value={formData.voltageLevel}
                    onChange={(e) =>
                      setFormData({ ...formData, voltageLevel: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    P Cực đại (kW)
                  </label>
                  <input
                    type="text"
                    value={formData.maxPower}
                    onChange={(e) =>
                      setFormData({ ...formData, maxPower: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    P TB ngày (kW)
                  </label>
                  <input
                    type="text"
                    value={formData.avgDailyPower}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        avgDailyPower: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                {/* BỔ SUNG: Công suất nhỏ nhất */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    P Nhỏ nhất (kW)
                  </label>
                  <input
                    type="text"
                    value={formData.minPower}
                    onChange={(e) =>
                      setFormData({ ...formData, minPower: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    Sản lượng TB (kWh)
                  </label>
                  <input
                    type="text"
                    value={formData.registeredVolume}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        registeredVolume: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Hồ sơ pháp lý
                </label>
                <input
                  type="text"
                  value={formData.legalDocuments}
                  onChange={(e) =>
                    setFormData({ ...formData, legalDocuments: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg italic"
                  placeholder="Tên file..."
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition-all uppercase text-[10px]"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-2 bg-[#1e3a5f] text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-md uppercase text-[10px]"
              >
                Lưu dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa khách hàng này không?"
        type="danger"
        confirmText="Xóa dữ liệu"
        isLoading={loading}
      />
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        title="Thành công!"
        message={successMessage}
      />
    </div>
  );
}
