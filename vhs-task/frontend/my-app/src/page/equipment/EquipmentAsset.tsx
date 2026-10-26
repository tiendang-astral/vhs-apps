'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, X, FileSpreadsheet, Upload, DownloadCloud, FileText } from 'lucide-react';
import ImportExcel from '../import/ImportExcel';
import { downloadExcel } from '../utils/excelUtils';

interface Equipment {
  id: string;
  ngay: string;
  asset: string;          // Field mới từ Excel
  assetId: string;
  tenThietBi: string;
  loaiGiaoDich: string;
  soLuong: number;
  khoDi: string;
  khoDen: string;
  nguoiXuat: string;      // Field mới từ Excel
  nguoiNhan: string;      // Field mới từ Excel
  lyDo: string;           // Field mới từ Excel
  chungTu: string;        // Field mới từ Excel
}

export default function EquipmentAssetPage() {
  const [equipments, setEquipments] = useState<Equipment[]>([
    {
      id: '1',
      ngay: '2026-01-01',
      asset: 'MBA_630-22',
      assetId: 'MBA_630-22-01',
      tenThietBi: 'MBA 630KVA 22/0.4',
      loaiGiaoDich: 'Nhập',
      soLuong: 1,
      khoDi: 'BHH',
      khoDen: 'KH',
      nguoiXuat: 'Nguyen Van A',
      nguoiNhan: 'Nguyen Van B',
      lyDo: 'Phục vụ công việc C',
      chungTu: ''
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Equipment>({
    id: '', ngay: '', asset: '', assetId: '', tenThietBi: '', loaiGiaoDich: 'Nhập',
    soLuong: 0, khoDi: '', khoDen: '', nguoiXuat: '', nguoiNhan: '', lyDo: '', chungTu: ''
  });

  const warehouses = ['BHH', 'KH', 'KHO TỔNG', 'CÔNG TRƯỜNG'];
  const transactionTypes = ['Nhập', 'Xuất', 'Điều chuyển'];

  const openModal = (equipment?: Equipment) => {
    if (equipment) {
      setFormData(equipment);
      setEditingId(equipment.id);
    } else {
      setFormData({
        id: Date.now().toString(), ngay: new Date().toISOString().split('T')[0], 
        asset: '', assetId: '', tenThietBi: '',
        loaiGiaoDich: 'Nhập', soLuong: 0, khoDi: '', khoDen: '',
        nguoiXuat: '', nguoiNhan: '', lyDo: '', chungTu: ''
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      setEquipments(equipments.map(e => e.id === editingId ? formData : e));
    } else {
      setEquipments([...equipments, formData]);
    }
    setIsModalOpen(false);
  };

  const handleExport = () => {
    const headers = ['Ngày', 'Asset', 'Asset ID', 'Tên thiết bị', 'Giao dịch', 'SL', 'Kho đi', 'Kho đến', 'Người xuất', 'Người nhận', 'Lý do', 'Chứng từ'];
    downloadExcel(equipments, 'Lich-su-giao-dich-thiet-bi', headers);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header đồng bộ */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-black text-[#1e3a5f] uppercase tracking-tight">Xuất - Nhập - Điều chuyển</h1>
          <p className="text-sm text-slate-500 italic font-medium">Lịch sử biến động vật tư thiết bị trên hệ thống</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold shadow-sm uppercase">
            <FileSpreadsheet size={16} /> Xuất Excel
          </button>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition-all text-xs font-bold shadow-sm uppercase">
            <Plus size={16} /> Tạo giao dịch
          </button>
        </div>
      </div>

      {/* Bảng dữ liệu đầy đủ field */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] text-left border-collapse min-w-[1800px]">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="px-3 py-4 border border-slate-600 text-center w-12">STT</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Ngày</th>
                <th className="px-4 py-4 border border-slate-600">Asset</th>
                <th className="px-4 py-4 border border-slate-600">Asset ID</th>
                <th className="px-4 py-4 border border-slate-600">Tên thiết bị</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Giao dịch</th>
                <th className="px-4 py-4 border border-slate-600 text-center">SL</th>
                <th className="px-4 py-4 border border-slate-600">Kho đi</th>
                <th className="px-4 py-4 border border-slate-600">Kho đến</th>
                <th className="px-4 py-4 border border-slate-600">Người xuất</th>
                <th className="px-4 py-4 border border-slate-600">Người nhận</th>
                <th className="px-4 py-4 border border-slate-600">Lý do</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Chứng từ</th>
                <th className="px-4 py-4 border border-slate-600 text-center sticky right-0 bg-[#1e3a5f] w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
              {equipments.map((e, index) => (
                <tr key={e.id} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-3 py-3 text-center border text-slate-400 font-normal">{index + 1}</td>
                  <td className="px-4 py-3 border text-center font-bold text-slate-500">{e.ngay}</td>
                  <td className="px-4 py-3 border font-semibold">{e.asset}</td>
                  <td className="px-4 py-3 border font-mono text-blue-700 font-bold">{e.assetId}</td>
                  <td className="px-4 py-3 border text-slate-900">{e.tenThietBi}</td>
                  <td className="px-4 py-3 border text-center">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase shadow-sm ${
                      e.loaiGiaoDich === 'Nhập' ? 'bg-emerald-100 text-emerald-700' :
                      e.loaiGiaoDich === 'Xuất' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {e.loaiGiaoDich}
                    </span>
                  </td>
                  <td className="px-4 py-3 border text-center font-black text-slate-900">{e.soLuong}</td>
                  <td className="px-4 py-3 border uppercase text-slate-500">{e.khoDi || '-'}</td>
                  <td className="px-4 py-3 border uppercase text-slate-500">{e.khoDen || '-'}</td>
                  <td className="px-4 py-3 border italic text-slate-600">{e.nguoiXuat}</td>
                  <td className="px-4 py-3 border italic text-slate-600">{e.nguoiNhan}</td>
                  <td className="px-4 py-3 border text-slate-500 truncate max-w-[150px] font-normal">{e.lyDo}</td>
                  <td className="px-4 py-3 border text-center">
                    {e.chungTu ? <FileText size={16} className="mx-auto text-blue-500 cursor-pointer" /> : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-3 border text-center sticky right-0 bg-white group-hover:bg-blue-50 transition-colors">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openModal(e)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={16} /></button>
                      <button onClick={() => setEquipments(equipments.filter(item => item.id !== e.id))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal giữ 100% field từ Excel */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-black text-[#1e3a5f] uppercase tracking-wide">
                {editingId ? 'Cập nhật giao dịch' : 'Khai báo giao dịch mới'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-white grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Ngày</label>
                <input type="date" value={formData.ngay} onChange={(e) => setFormData({ ...formData, ngay: e.target.value })} className="w-full px-4 py-2 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Asset (Mã chủng loại)</label>
                <input type="text" value={formData.asset} onChange={(e) => setFormData({ ...formData, asset: e.target.value })} className="w-full px-4 py-2 border rounded-xl focus:ring-4 focus:ring-blue-100 outline-none" placeholder="VD: MBA_630-22" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Asset ID (Số hiệu)</label>
                <input type="text" value={formData.assetId} onChange={(e) => setFormData({ ...formData, assetId: e.target.value })} className="w-full px-4 py-2 border rounded-xl font-mono" placeholder="VD: MBA_630-22-01" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Tên thiết bị</label>
                <input type="text" value={formData.tenThietBi} onChange={(e) => setFormData({ ...formData, tenThietBi: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Giao dịch</label>
                <select value={formData.loaiGiaoDich} onChange={(e) => setFormData({ ...formData, loaiGiaoDich: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                  {transactionTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Số lượng</label>
                <input type="number" value={formData.soLuong} onChange={(e) => setFormData({ ...formData, soLuong: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border rounded-xl font-bold text-[#1e3a5f]" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Kho đi</label>
                <select value={formData.khoDi} onChange={(e) => setFormData({ ...formData, khoDi: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                  <option value="">-- Chọn kho --</option>
                  {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Kho đến</label>
                <select value={formData.khoDen} onChange={(e) => setFormData({ ...formData, khoDen: e.target.value })} className="w-full px-3 py-2 border rounded-xl">
                  <option value="">-- Chọn kho --</option>
                  {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Người xuất</label>
                <input type="text" value={formData.nguoiXuat} onChange={(e) => setFormData({ ...formData, nguoiXuat: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Người nhận</label>
                <input type="text" value={formData.nguoiNhan} onChange={(e) => setFormData({ ...formData, nguoiNhan: e.target.value })} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Chứng từ đính kèm (URL)</label>
                <input type="text" value={formData.chungTu} onChange={(e) => setFormData({ ...formData, chungTu: e.target.value })} className="w-full px-4 py-2 border rounded-xl" placeholder="Link file..." />
              </div>
              <div className="md:col-span-3 space-y-1 mt-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Lý do giao dịch</label>
                <textarea value={formData.lyDo} onChange={(e) => setFormData({ ...formData, lyDo: e.target.value })} className="w-full px-4 py-2 border rounded-xl h-20 outline-none focus:ring-4 focus:ring-blue-100 transition-all" />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-200 transition-colors uppercase text-xs">Hủy bỏ</button>
              <button onClick={handleSave} className="px-10 py-2 bg-[#1e3a5f] text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-md uppercase text-xs tracking-wider">Xác nhận giao dịch</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}