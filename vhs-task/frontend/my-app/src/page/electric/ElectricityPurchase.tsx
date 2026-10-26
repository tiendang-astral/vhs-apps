'use client';

import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit2, X, FileSpreadsheet, Zap, Save, Calculator, TrendingUp, TrendingDown, Loader2, Search } from 'lucide-react';
import { electricApi } from './ElectricApi';
import { customerApi } from './CustomerApi'; 
import ConfirmModal from '../../component/ConfirmModal'; 
import SuccessModal from '../../component/SuccessModal';

interface ElectricityUsage {
  id: string;
  customerId: string;    
  maKhachHang?: string;   
  tenKhachHang?: string;  
  tinh?: string;          
  kcnCcn?: string;        
  year: number;
  month: number;
  price_FlatRate: number | string;
  price_Normal: number | string;
  price_Peak: number | string;
  price_OffPeak: number | string;
  p_FlatRate: number | string;
  p_Normal: number | string;
  p_Peak: number | string;
  p_OffPeak: number | string;
  totalConsumption: number;
  amount_FlatRate: number;
  amount_Normal: number;
  amount_Peak: number;
  amount_OffPeak: number;
  totalBillAmount: number;
}

interface Customer {
  id: string;
  customerName: string;
  province: string;
  industrialZone: string;
}

export default function ElectricityUsagePage() {
  const [activeMonth, setActiveMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  
  const [data, setData] = useState<ElectricityUsage[]>([]);
  const [customersList, setCustomersList] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState<ElectricityUsage>({
    id: '', customerId: '', year: new Date().getFullYear(), month: new Date().getMonth() + 1,
    price_FlatRate: '', price_Normal: '', price_Peak: '', price_OffPeak: '',
    p_FlatRate: '', p_Normal: '', p_Peak: '', p_OffPeak: '', totalConsumption: 0,
    amount_FlatRate: 0, amount_Normal: 0, amount_Peak: 0, amount_OffPeak: 0, totalBillAmount: 0
  });

  const loadDataByMonth = async () => {
    try {
      setIsLoading(true);
      const [year, month] = activeMonth.split('-').map(Number);
      const [usageRes, customerRes] = await Promise.all([
        electricApi.getByMonth(year, month),
        customerApi.getAll() 
      ]);
      setData(usageRes.data || []);
      setCustomersList(customerRes.data || []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDataByMonth();
  }, [activeMonth]);

  const handleCustomerChange = (selectedId: string) => {
    const selected = customersList.find(c => c.id === selectedId);
    if (selected) {
      setFormData({
        ...formData,
        customerId: selected.id,
        maKhachHang: selected.id,
        tenKhachHang: selected.customerName,
        tinh: selected.province,
        kcnCcn: selected.industrialZone
      });
    }
  };

  const getGrowth = (current: ElectricityUsage) => {
    const prevMonth = current.month === 1 ? 12 : current.month - 1;
    const prevYear = current.month === 1 ? current.year - 1 : current.year;
    const prevData = data.find(d => d.customerId === current.customerId && d.month === prevMonth && d.year === prevYear);
    if (!prevData || prevData.totalConsumption === 0) return null;
    return ((current.totalConsumption - prevData.totalConsumption) / prevData.totalConsumption) * 100;
  };

  useEffect(() => {
    const p_norm = Number(formData.p_Normal || 0);
    const p_peak = Number(formData.p_Peak || 0);
    const p_off = Number(formData.p_OffPeak || 0);
    const p_flat = Number(formData.p_FlatRate || 0);

    const pr_norm = Number(formData.price_Normal || 0);
    const pr_peak = Number(formData.price_Peak || 0);
    const pr_off = Number(formData.price_OffPeak || 0);
    const pr_flat = Number(formData.price_FlatRate || 0);

    const p_tong = p_norm + p_peak + p_off + p_flat;
    const t_norm = p_norm * pr_norm;
    const t_peak = p_peak * pr_peak;
    const t_off = p_off * pr_off;
    const t_flat = p_flat * pr_flat;

    setFormData(prev => ({
      ...prev,
      totalConsumption: p_tong,
      amount_FlatRate: t_flat,
      amount_Normal: t_norm,
      amount_Peak: t_peak,
      amount_OffPeak: t_off,
      totalBillAmount: t_flat + t_norm + t_peak + t_off
    }));
  }, [formData.p_FlatRate, formData.p_Normal, formData.p_Peak, formData.p_OffPeak, 
      formData.price_FlatRate, formData.price_Normal, formData.price_Peak, formData.price_OffPeak]);

  const openModal = (item?: ElectricityUsage) => {
    if (item) {
      setFormData({
        ...item,
        price_FlatRate: item.price_FlatRate === 0 ? '' : item.price_FlatRate,
        price_Normal: item.price_Normal === 0 ? '' : item.price_Normal,
        price_Peak: item.price_Peak === 0 ? '' : item.price_Peak,
        price_OffPeak: item.price_OffPeak === 0 ? '' : item.price_OffPeak,
        p_FlatRate: item.p_FlatRate === 0 ? '' : item.p_FlatRate,
        p_Normal: item.p_Normal === 0 ? '' : item.p_Normal,
        p_Peak: item.p_Peak === 0 ? '' : item.p_Peak,
        p_OffPeak: item.p_OffPeak === 0 ? '' : item.p_OffPeak,
      });
      setEditingId(item.id);
    } else {
      const [year, month] = activeMonth.split('-').map(Number);
      setFormData({
        id: '', customerId: '', year, month,
        price_FlatRate: '', price_Normal: '', price_Peak: '', price_OffPeak: '',
        p_FlatRate: '', p_Normal: '', p_Peak: '', p_OffPeak: '', totalConsumption: 0,
        amount_FlatRate: 0, amount_Normal: 0, amount_Peak: 0, amount_OffPeak: 0, totalBillAmount: 0
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        price_FlatRate: Number(formData.price_FlatRate || 0),
        price_Normal: Number(formData.price_Normal || 0),
        price_Peak: Number(formData.price_Peak || 0),
        price_OffPeak: Number(formData.price_OffPeak || 0),
        p_FlatRate: Number(formData.p_FlatRate || 0),
        p_Normal: Number(formData.p_Normal || 0),
        p_Peak: Number(formData.p_Peak || 0),
        p_OffPeak: Number(formData.p_OffPeak || 0),
      };

      if (editingId) {
        await electricApi.updateUsage(editingId, payload);
        setSuccessMessage("Dữ liệu chỉ số điện đã được cập nhật.");
      } else {
        await electricApi.createUsage(payload);
        setSuccessMessage("Đã thêm chỉ số điện mới thành công.");
      }
      setIsModalOpen(false);
      setIsSuccessModalOpen(true);
      loadDataByMonth();
    } catch (error) { console.error(error); }
  };

  const handleDelete = async () => {
    if (itemToDelete) {
      try {
        await electricApi.deleteUsage(itemToDelete);
        setSuccessMessage("Đã xóa chỉ số điện khỏi hệ thống.");
        loadDataByMonth();
        setIsDeleteModalOpen(false);
        setIsSuccessModalOpen(true);
      } catch (error) { console.error(error); }
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.tenKhachHang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.maKhachHang?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  return (
    <div className="space-y-4 p-4 bg-slate-50 min-h-screen font-sans text-slate-900">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-[#1e3a5f] uppercase tracking-tight flex items-center gap-2">
            <Zap className="text-amber-500" size={24} />
            QUẢN LÝ SỬ DỤNG ĐIỆN
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Xem theo tháng:</span>
            <input 
              type="month" 
              value={activeMonth}
              onChange={(e) => setActiveMonth(e.target.value)}
              className="text-xs font-bold text-blue-700 border-none bg-blue-50 px-2 py-1 rounded-md outline-none cursor-pointer"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative mr-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Tìm khách hàng..."
              className="pl-9 pr-4 py-2 border rounded-lg text-xs outline-none focus:ring-2 ring-blue-100 w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold uppercase shadow-sm">
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all text-xs font-bold uppercase shadow-md">
            <Plus size={16} /> Thêm chỉ số
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Đang tải dữ liệu tháng...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse min-w-[2400px]">
              <thead className="bg-[#1e3a5f] text-white uppercase text-center">
                <tr>
                  <th rowSpan={2} className="px-2 py-3 border border-slate-600 sticky left-0 bg-[#1e3a5f] z-10 w-12">TT</th>
                  <th rowSpan={2} className="px-3 py-3 border border-slate-600 sticky left-12 bg-[#1e3a5f] z-10 w-32">Mã KH</th>
                  <th rowSpan={2} className="px-3 py-3 border border-slate-600">Tỉnh</th>
                  <th rowSpan={2} className="px-3 py-3 border border-slate-600">KCN/CCN</th>
                  <th rowSpan={2} className="px-3 py-3 border border-slate-600 w-64">Tên Khách Hàng</th>
                  <th rowSpan={2} className="px-2 py-3 border border-slate-600 w-20">Tháng/Năm</th>
                  <th colSpan={4} className="px-3 py-2 border border-slate-600 bg-blue-900/50">Giá bán điện (đ)</th>
                  <th colSpan={6} className="px-3 py-2 border border-slate-600 bg-orange-900/50">Điện năng tiêu thụ (kWh)</th>
                  <th colSpan={5} className="px-3 py-2 border border-slate-600 bg-emerald-900/50">Thành tiền (đ)</th>
                  <th rowSpan={2} className="px-3 py-3 border border-slate-600 sticky right-0 bg-[#1e3a5f] z-10">Thao tác</th>
                </tr>
                <tr className="bg-[#2c4e7a] text-[10px]">
                  <th>Ko theo TG</th><th>Bình thường</th><th>Cao điểm</th><th>Thấp điểm</th>
                  <th>Ko theo TG</th><th>Bình thường</th><th>Cao điểm</th><th>Thấp điểm</th><th className="bg-orange-800/40">Tổng P</th>
                  <th className="bg-amber-600/40 font-black italic">Tăng trưởng (%)</th>
                  <th>Ko theo TG</th><th>Bình thường</th><th>Cao điểm</th><th>Thấp điểm</th><th className="bg-emerald-800/40">Tổng Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredData.map((item, index) => {
                  const growth = getGrowth(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors text-slate-700 font-medium">
                      <td className="p-2 text-center border sticky left-0 bg-white">{index + 1}</td>
                      <td className="p-2 text-center border font-bold text-rose-600 sticky left-12 bg-white">{item.maKhachHang}</td>
                      <td className="p-2 border text-center">{item.tinh}</td>
                      <td className="p-2 border text-center">{item.kcnCcn}</td>
                      <td className="p-2 border font-bold text-slate-900 uppercase leading-tight">{item.tenKhachHang}</td>
                      <td className="p-2 border text-center font-bold text-blue-700">{item.month}/{item.year}</td>
                      <td className="p-2 border text-right">{Number(item.price_FlatRate).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.price_Normal).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.price_Peak).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.price_OffPeak).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.p_FlatRate).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.p_Normal).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.p_Peak).toLocaleString()}</td>
                      <td className="p-2 border text-right">{Number(item.p_OffPeak).toLocaleString()}</td>
                      <td className="p-2 border text-right font-black text-orange-700 bg-orange-50/50">{item.totalConsumption.toLocaleString()}</td>
                      <td className={`p-2 border text-center font-bold bg-amber-50/30 ${growth !== null ? (growth >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
                        {growth !== null ? (
                          <div className="flex items-center justify-center gap-1">
                            {growth >= 0 ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                            {growth.toFixed(1)}%
                          </div>
                        ) : '--'}
                      </td>
                      <td className="p-2 border text-right">{item.amount_FlatRate.toLocaleString()}</td>
                      <td className="p-2 border text-right">{item.amount_Normal.toLocaleString()}</td>
                      <td className="p-2 border text-right">{item.amount_Peak.toLocaleString()}</td>
                      <td className="p-2 border text-right">{item.amount_OffPeak.toLocaleString()}</td>
                      <td className="p-2 border text-right font-black text-emerald-700 bg-emerald-50/50">{item.totalBillAmount.toLocaleString()}</td>
                      <td className="p-2 border text-center sticky right-0 bg-white shadow-[-4px_0_10px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => { setItemToDelete(item.id); setIsDeleteModalOpen(true); }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b flex justify-between items-center bg-[#1e3a5f] text-white">
              <div className="flex items-center gap-2">
                <Calculator size={20} className="text-amber-400" />
                <h2 className="font-black uppercase tracking-wide">{editingId ? 'Cập nhật chỉ số' : 'Thêm chỉ số mới'}</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-4 grid grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Mã khách hàng</label>
                  <select 
                    value={formData.customerId} 
                    onChange={(e) => handleCustomerChange(e.target.value)}
                    disabled={!!editingId}
                    className={`w-full px-3 py-2 border rounded-lg font-bold text-rose-600 outline-none focus:ring-2 ring-rose-200 ${editingId ? 'bg-slate-100' : 'bg-white'}`}
                  >
                    <option value="">-- Chọn mã --</option>
                    {customersList.map(c => (
                      <option key={c.id} value={c.id}>{c.id}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tỉnh (Auto)</label>
                  <input type="text" disabled value={formData.tinh || ''} className="w-full px-3 py-2 border rounded-lg bg-slate-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">KCN/CCN (Auto)</label>
                  <input type="text" disabled value={formData.kcnCcn || ''} className="w-full px-3 py-2 border rounded-lg bg-slate-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tên Khách Hàng (Auto)</label>
                  <input type="text" disabled value={formData.tenKhachHang || ''} className="w-full px-3 py-2 border rounded-lg font-bold bg-slate-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tháng/Năm</label>
                  <div className="flex gap-2">
                    <input type="number" value={formData.month} onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })} className="w-1/2 px-2 py-2 border rounded-lg text-center font-bold" />
                    <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })} className="w-1/2 px-2 py-2 border rounded-lg text-center font-bold" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-3 bg-orange-50/30 p-4 rounded-xl border border-orange-100">
                <h3 className="text-xs font-black text-orange-700 uppercase flex items-center gap-2"><TrendingUp size={16} /> 1. Sản lượng tiêu thụ (kWh)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { field: 'p_Normal', label: 'Bình thường' },
                    { field: 'p_Peak', label: 'Cao điểm' },
                    { field: 'p_OffPeak', label: 'Thấp điểm' },
                    { field: 'p_FlatRate', label: 'Ko theo TG' }
                  ].map((item) => (
                    <div key={item.field} className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">{item.label}</label>
                      <input 
                        type="number" 
                        value={(formData as any)[item.field]} 
                        onChange={(e) => setFormData({ ...formData, [item.field]: e.target.value === "" ? "" : Number(e.target.value) })} 
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-orange-200" 
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-2 space-y-3 bg-blue-50/30 p-4 rounded-xl border border-blue-100">
                <h3 className="text-xs font-black text-blue-700 uppercase flex items-center gap-2"><Zap size={16} /> 2. Giá bán điện (VNĐ)</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { field: 'price_Normal', label: 'Bình thường' },
                    { field: 'price_Peak', label: 'Cao điểm' },
                    { field: 'price_OffPeak', label: 'Thấp điểm' },
                    { field: 'price_FlatRate', label: 'Ko theo TG' }
                  ].map((item) => (
                    <div key={item.field} className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">{item.label}</label>
                      <input 
                        type="number" 
                        value={(formData as any)[item.field]} 
                        onChange={(e) => setFormData({ ...formData, [item.field]: e.target.value === "" ? "" : Number(e.target.value) })} 
                        className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 ring-blue-200" 
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="md:col-span-4 bg-emerald-900 text-white p-5 rounded-xl flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Tổng sản lượng</p>
                  <p className="text-3xl font-black">{formData.totalConsumption.toLocaleString()} <span className="text-sm font-light">kWh</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Tổng thành tiền</p>
                  <p className="text-3xl font-black text-amber-400">{formData.totalBillAmount.toLocaleString()} <span className="text-sm font-light text-white">VNĐ</span></p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold text-[10px] uppercase">Hủy bỏ</button>
              <button onClick={handleSave} className="px-8 py-2 bg-[#1e3a5f] text-white rounded-lg font-bold shadow-md text-[10px] uppercase flex items-center gap-2 hover:bg-slate-800 transition-all">
                <Save size={16} /> Lưu dữ liệu
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
        message="Bạn có chắc chắn muốn xóa dữ liệu này?"
        type="danger"
        confirmText="Xóa dữ liệu"
      />
      <SuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
        message={successMessage}
      />
    </div>
  );
}