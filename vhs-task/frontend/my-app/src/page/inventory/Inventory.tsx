'use client';

import { useState } from 'react';
import { Plus, Trash2, Edit2, X, FileSpreadsheet, AlertTriangle, Package, Calendar, User } from 'lucide-react';

interface Inventory {
  id: string;
  stt: number;
  asset: string;        // Cột 1: Asset
  assetId: string;      // Cột 2: Asset ID
  tenThietBi: string;   // Cột 3: Tên thiết bị
  kho: string;          // Cột 4: Kho
  soLuongTon: number;   // Cột 5: Số lượng tồn
  tinhTrang: string;    // Cột 6: Tình trạng
  mucToiThieu: number;  // Cột 7: Mức tối thiểu
  canhBao: string;      // Cột 8: Cảnh báo
  ngayCapNhat: string;  // Cột 9: Ngày cập nhật
  nguoiCapNhat: string; // Cột 10: Người cập nhật
  ghiChu: string;       // Cột 11: Ghi chú
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<Inventory[]>([
    {
      id: '1',
      stt: 1,
      asset: 'MBA_630-22',
      assetId: 'MBA_630-22-01',
      tenThietBi: 'MBA 630KVA 22/0.4',
      kho: 'BHH',
      soLuongTon: 1,
      tinhTrang: 'Mới',
      mucToiThieu: 1,
      canhBao: 'N/A',
      ngayCapNhat: '2026.01.01',
      nguoiCapNhat: 'Nguyen Van A',
      ghiChu: ''
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Inventory>({
    id: '', stt: 0, asset: '', assetId: '', tenThietBi: '', kho: '', 
    soLuongTon: 0, tinhTrang: 'Mới', mucToiThieu: 0, canhBao: '', 
    ngayCapNhat: '', nguoiCapNhat: '', ghiChu: ''
  });

  const warehouses = ['BHH', 'KHO_01', 'KHO_02'];
  const conditions = ['Mới', 'Đã điều chuyển', 'Cần bảo trì'];

  const openModal = (inventory?: Inventory) => {
    if (inventory) {
      setFormData(inventory);
      setEditingId(inventory.id);
    } else {
      setFormData({
        id: Date.now().toString(),
        stt: inventories.length + 1,
        asset: '', assetId: '', tenThietBi: '', kho: '', 
        soLuongTon: 0, tinhTrang: 'Mới', mucToiThieu: 1, canhBao: 'Bình thường',
        ngayCapNhat: new Date().toLocaleDateString('vi-VN'),
        nguoiCapNhat: '', ghiChu: ''
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingId) {
      setInventories(inventories.map(i => i.id === editingId ? formData : i));
    } else {
      setInventories([...inventories, formData]);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header section */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-black text-[#1e3a5f] uppercase tracking-tight">Tồn kho hiện tại</h1>
          <p className="text-slate-500 text-sm italic">Thống kê hiện trạng, số lượng vật tư đang có trong kho</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-all text-xs font-bold shadow-sm uppercase">
            <FileSpreadsheet size={16} /> Xuất dữ liệu
          </button>
          <button onClick={() => openModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-xs font-bold shadow-sm uppercase">
            <Plus size={16} /> Thêm vật tư
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-left border-collapse min-w-[1600px]">
            <thead className="bg-[#1e3a5f] text-white">
              <tr>
                <th className="px-3 py-4 border border-slate-600 text-center w-12">STT</th>
                <th className="px-4 py-4 border border-slate-600">Asset</th>
                <th className="px-4 py-4 border border-slate-600 font-bold text-yellow-400">Asset ID</th>
                <th className="px-4 py-4 border border-slate-600">Tên thiết bị</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Kho</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Số lượng tồn</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Tình trạng</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Mức tối thiểu</th>
                <th className="px-4 py-4 border border-slate-600 text-center">Cảnh báo</th>
                <th className="px-4 py-4 border border-slate-600">Ngày cập nhật</th>
                <th className="px-4 py-4 border border-slate-600">Người cập nhật</th>
                <th className="px-4 py-4 border border-slate-600">Ghi chú</th>
                <th className="px-4 py-4 border border-slate-600 text-center sticky right-0 bg-[#1e3a5f] w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inventories.map((item) => (
                <tr key={item.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-3 py-3 text-center border text-slate-400">{item.stt}</td>
                  <td className="px-4 py-3 border font-medium text-slate-600 uppercase italic">{item.asset}</td>
                  <td className="px-4 py-3 border font-bold text-blue-700 font-mono">{item.assetId}</td>
                  <td className="px-4 py-3 border font-semibold text-slate-800">{item.tenThietBi}</td>
                  <td className="px-4 py-3 border text-center font-bold text-slate-700">{item.kho}</td>
                  <td className="px-4 py-3 border text-center">
                     <span className="text-lg font-black text-[#1e3a5f]">{item.soLuongTon}</span>
                  </td>
                  <td className="px-4 py-3 border text-center">
                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-[11px] font-bold uppercase">{item.tinhTrang}</span>
                  </td>
                  <td className="px-4 py-3 border text-center text-slate-500 font-bold">{item.mucToiThieu}</td>
                  <td className="px-4 py-3 border text-center">
                    {item.soLuongTon < item.mucToiThieu ? (
                      <span className="flex items-center justify-center gap-1 text-red-600 font-black animate-pulse uppercase text-[11px]">
                        <AlertTriangle size={14} /> Dưới định mức
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold text-[11px] uppercase">An toàn</span>
                    )}
                  </td>
                  <td className="px-4 py-3 border text-slate-500 font-mono">{item.ngayCapNhat}</td>
                  <td className="px-4 py-3 border font-medium text-slate-700 uppercase">{item.nguoiCapNhat}</td>
                  <td className="px-4 py-3 border text-slate-400 italic truncate max-w-[150px]">{item.ghiChu || '-'}</td>
                  <td className="px-4 py-3 border text-center sticky right-0 bg-white group-hover:bg-blue-50 transition-colors">
                    <div className="flex justify-center gap-1">
                      <button onClick={() => openModal(item)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => setInventories(inventories.filter(i => i.id !== item.id))} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="p-4 border-b bg-[#1e3a5f] flex justify-between items-center text-white">
              <h2 className="text-md font-black uppercase tracking-widest flex items-center gap-2">
                <Package size={20} /> {editingId ? 'Cập nhật tồn kho' : 'Khai báo vật tư mới'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 bg-white">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">1. Asset (Mã chủng loại)</label>
                <input type="text" value={formData.asset} onChange={(e) => setFormData({ ...formData, asset: e.target.value })} className="w-full px-4 py-2 border-2 rounded-xl focus:border-blue-500 outline-none transition-all uppercase font-bold text-slate-700" placeholder="VD: MBA_630-22" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">2. Asset ID (Mã định danh)</label>
                <input type="text" value={formData.assetId} onChange={(e) => setFormData({ ...formData, assetId: e.target.value })} className="w-full px-4 py-2 border-2 rounded-xl focus:border-blue-500 outline-none transition-all font-mono font-bold text-blue-700" placeholder="VD: MBA_630-22-01" />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">3. Tên thiết bị kỹ thuật</label>
                <input type="text" value={formData.tenThietBi} onChange={(e) => setFormData({ ...formData, tenThietBi: e.target.value })} className="w-full px-4 py-2 border-2 rounded-xl focus:border-blue-500 outline-none transition-all font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">4. Kho lưu trữ</label>
                <select value={formData.kho} onChange={(e) => setFormData({ ...formData, kho: e.target.value })} className="w-full px-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500">
                  <option value="">-- Chọn kho --</option>
                  {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">5. Số lượng tồn kho</label>
                <input type="number" value={formData.soLuongTon} onChange={(e) => setFormData({ ...formData, soLuongTon: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500 font-black text-blue-600 text-lg" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">6. Tình trạng</label>
                <select value={formData.tinhTrang} onChange={(e) => setFormData({ ...formData, tinhTrang: e.target.value })} className="w-full px-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500">
                  {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">7. Mức tối thiểu (Spare)</label>
                <input type="number" value={formData.mucToiThieu} onChange={(e) => setFormData({ ...formData, mucToiThieu: parseInt(e.target.value) || 0 })} className="w-full px-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500 font-bold text-red-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">9. Ngày cập nhật</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input type="text" value={formData.ngayCapNhat} onChange={(e) => setFormData({ ...formData, ngayCapNhat: e.target.value })} className="w-full pl-10 pr-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500 font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase">10. Người thực hiện</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input type="text" value={formData.nguoiCapNhat} onChange={(e) => setFormData({ ...formData, nguoiCapNhat: e.target.value })} className="w-full pl-10 pr-4 py-2 border-2 rounded-xl outline-none focus:border-blue-500 uppercase font-bold" />
                </div>
              </div>
              <div className="md:col-span-2 space-y-1 mt-2">
                <label className="text-[11px] font-black text-slate-500 uppercase">11. Ghi chú kỹ thuật</label>
                <textarea value={formData.ghiChu} onChange={(e) => setFormData({ ...formData, ghiChu: e.target.value })} className="w-full px-4 py-3 border-2 rounded-xl outline-none h-24 focus:border-blue-500 transition-all" />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 rounded-xl text-slate-600 font-black hover:bg-slate-200 transition-colors uppercase text-xs">Hủy bỏ</button>
              <button onClick={handleSave} className="px-10 py-2 bg-[#1e3a5f] text-white rounded-xl font-black hover:bg-slate-800 transition-all shadow-lg uppercase text-xs tracking-widest">Xác nhận lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}