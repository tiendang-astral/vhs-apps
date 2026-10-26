'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Save, Image as ImageIcon, Loader2 } from 'lucide-react';
import { specificationApi } from './specificationApi'; // Đảm bảo đúng path tới file api của bạn

interface Specification {
  id: string;
  stt: number;
  asset: string;        // Ánh xạ AssetCode BE
  name: string; 
  nhom: string;         // Ánh xạ Group BE
  chungLoai: string;    // Ánh xạ Category BE
  phase: string;
  capDienAp: string;    // Ánh xạ VoltageLevel BE
  hangSx: string;       // Ánh xạ Manufacturer BE
  model: string;
  serial: string;       // Ánh xạ SerialNumber BE
  tongSoLuong: number;  // Ánh xạ TotalQuantity BE
  donVi: string;        // Ánh xạ Unit BE
  tuoiTho: number;      // Ánh xạ Lifespan BE
  hinhAnh: string;      // Ánh xạ ImageUrl BE
  ghiChu: string;       // Ánh xạ Note BE
}

export default function SpecificationsPage() {
  const [specifications, setSpecifications] = useState<Specification[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Bộ gõ thông minh theo đúng logic ảnh 9
  const [parts, setParts] = useState({ 
    type: '',     // Chủng loại (MBA, CAB...)
    phase: '',    // Phase (1P/3P)
    spec: '',     // Thông số (630kVA, AC185...)
    volt: ''      // Cấp điện áp (22kV...)
  });

  const [formData, setFormData] = useState<Specification>({
    id: '', stt: 1, asset: '', name: '', nhom: 'Thiết bị chính', chungLoai: '',
    phase: '', capDienAp: '', hangSx: '', model: '', serial: '',
    tongSoLuong: 1, donVi: 'Cái', tuoiTho: 0, hinhAnh: '', ghiChu: ''
  });

  // --- HÀM CALL API LẤY DANH SÁCH ---
  const loadData = async () => {
    try {
      setLoading(true);
      const res = await specificationApi.getAll();
      // Nếu BE trả về Response { data: [...] } thì dùng res.data.data
      const dataFromApi = res.data.data || res.data;
      
      // Map lại dữ liệu từ BE (Tiếng Anh) sang Interface FE (Tiếng Việt) nếu cần
      const mappedData = dataFromApi.map((item: any, index: number) => ({
        id: item.id,
        stt: index + 1,
        asset: item.assetCode,
        name: item.name,
        nhom: item.group,
        chungLoai: item.category,
        phase: item.phase,
        capDienAp: item.voltageLevel,
        hangSx: item.manufacturer,
        model: item.model,
        serial: item.serialNumber,
        tongSoLuong: item.totalQuantity,
        donVi: item.unit,
        tuoiTho: item.lifespan,
        hinhAnh: item.imageUrl,
        ghiChu: item.note
      }));
      setSpecifications(mappedData);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Tự động sinh Asset và Tên thiết bị (Khóa nhập tay)
  useEffect(() => {
    const assetStr = `${parts.type}_${parts.phase}_${parts.spec}_${parts.volt}`.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    const nameStr = `${parts.type} ${parts.phase} ${parts.spec} ${parts.volt}`.trim();

    setFormData(prev => ({
      ...prev,
      asset: assetStr,
      name: nameStr,
      chungLoai: parts.type,
      phase: parts.phase,
      capDienAp: parts.volt
    }));
  }, [parts]);

  // --- HÀM LƯU (CREATE / UPDATE) ---
  const handleSave = async () => {
    try {
      if (editingId) {
        await specificationApi.update(editingId, formData);
      } else {
        await specificationApi.create(formData);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setParts({ type: '', phase: '', spec: '', volt: '' });
      loadData(); // Load lại bảng sau khi lưu
    } catch (error) {
      alert("Lỗi khi lưu dữ liệu. Vui lòng kiểm tra lại kết nối BE.");
    }
  };

  // --- HÀM XÓA (DELETE) ---
  const handleDelete = async (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa hồ sơ kỹ thuật này?")) {
      try {
        await specificationApi.delete(id);
        loadData();
      } catch (error) {
        alert("Không thể xóa thiết bị này.");
      }
    }
  };

  return (
    <div className="p-4 space-y-4 font-sans text-[13px]">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#1e3a5f] uppercase">Hồ sơ thông số kỹ thuật</h1>
          <p className="text-slate-500 italic">Quản lý lý lịch thiết bị theo quy chuẩn Asset</p>
        </div>
        <button onClick={() => { setEditingId(null); setIsModalOpen(true); }} className="bg-blue-700 text-white px-5 py-2 rounded-md font-bold flex items-center gap-2 hover:bg-blue-800 transition-all">
          <Plus size={18} /> THÊM THÔNG SỐ
        </button>
      </div>

      {/* Table đầy đủ các cột */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto relative min-h-[300px]">
        {loading && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
                <Loader2 className="animate-spin text-blue-700" size={32} />
            </div>
        )}
        <table className="w-full text-left border-collapse min-w-[2200px]">
          <thead className="bg-[#1e3a5f] text-white uppercase text-[11px]">
            <tr>
              <th className="p-3 border border-slate-600 text-center">STT</th>
              <th className="p-3 border border-slate-600">Asset</th>
              <th className="p-3 border border-slate-600">Tên thiết bị</th>
              <th className="p-3 border border-slate-600">Nhóm</th>
              <th className="p-3 border border-slate-600">Chủng loại</th>
              <th className="p-3 border border-slate-600 text-center bg-yellow-600">1P/3P</th>
              <th className="p-3 border border-slate-600 text-center">Cấp điện áp</th>
              <th className="p-3 border border-slate-600">Hãng SX</th>
              <th className="p-3 border border-slate-600">Model</th>
              <th className="p-3 border border-slate-600">Serial</th>
              <th className="p-3 border border-slate-600 text-center">Tổng số lượng</th>
              <th className="p-3 border border-slate-600 text-center">Đơn vị</th>
              <th className="p-3 border border-slate-600 text-center">Tuổi thọ (Năm)</th>
              <th className="p-3 border border-slate-600 text-center">Ghi chú</th>
              <th className="p-3 border border-slate-600 text-center sticky right-0 bg-[#1e3a5f]">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {specifications.map((spec) => (
              <tr key={spec.id} className="hover:bg-slate-50 border-b border-slate-200">
                <td className="p-3 text-center font-bold">{spec.stt}</td>
                <td className="p-3 font-mono text-blue-700 font-bold">{spec.asset}</td>
                <td className="p-3 font-medium">{spec.name}</td>
                <td className="p-3 text-slate-600">{spec.nhom}</td>
                <td className="p-3 font-semibold">{spec.chungLoai}</td>
                <td className="p-3 text-center text-red-600 font-bold">{spec.phase}</td>
                <td className="p-3 text-center">{spec.capDienAp}</td>
                <td className="p-3">{spec.hangSx}</td>
                <td className="p-3">{spec.model}</td>
                <td className="p-3">{spec.serial}</td>
                <td className="p-3 text-center">{spec.tongSoLuong}</td>
                <td className="p-3 text-center">{spec.donVi}</td>
                <td className="p-3 text-center">{spec.tuoiTho}</td>
                <td className="p-3 text-slate-400">{spec.ghiChu}</td>
                <td className="p-3 text-center sticky right-0 bg-white shadow-[-2px_0_5px_rgba(0,0,0,0.05)]">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditingId(spec.id); setFormData(spec); setIsModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(spec.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="p-4 bg-[#1e3a5f] text-white flex justify-between items-center">
              <h2 className="font-bold uppercase tracking-wider">{editingId ? 'Cập nhật' : 'Thiết lập'} hồ sơ kỹ thuật thiết bị</h2>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }}><X size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50 space-y-6">
              {/* CỤM NHẬP MÃ NHANH */}
              <div className="grid grid-cols-4 gap-4 bg-white p-5 rounded-lg border-2 border-blue-100 shadow-sm relative">
                <div className="absolute -top-3 left-4 bg-blue-600 text-white px-3 py-0.5 rounded-full text-[10px] font-bold">CÔNG CỤ TỰ ĐỘNG SINH MÃ (ASSET GEN)</div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Chủng loại (MBA, CAB...)</label>
                  <input type="text" value={parts.type} onChange={e => setParts({...parts, type: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 ring-blue-500 outline-none" placeholder="VD: MBA" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Phase</label>
                  <select value={parts.phase} onChange={e => setParts({...parts, phase: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded bg-white">
                    <option value="">Chọn</option>
                    <option value="1P">1 Phase (1P)</option>
                    <option value="3P">3 Phase (3P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Thông số chính</label>
                  <input type="text" value={parts.spec} onChange={e => setParts({...parts, spec: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded" placeholder="630kVA / AC185" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Cấp điện áp</label>
                  <input type="text" value={parts.volt} onChange={e => setParts({...parts, volt: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded" placeholder="22kV / 35kV" />
                </div>
              </div>

              {/* FORM DỮ LIỆU CHI TIẾT */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase italic">Asset (Tự động - Khóa)</label>
                  <input type="text" value={formData.asset} readOnly className="w-full px-3 py-2 bg-slate-200 border border-slate-300 rounded font-bold text-blue-800 cursor-not-allowed shadow-inner" />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase italic">Tên thiết bị (Tự động - Khóa)</label>
                  <input type="text" value={formData.name} readOnly className="w-full px-3 py-2 bg-slate-200 border border-slate-300 rounded font-bold text-slate-700 cursor-not-allowed shadow-inner" />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Nhóm thiết bị</label>
                  <select value={formData.nhom} onChange={e => setFormData({...formData, nhom: e.target.value})} className="w-full px-3 py-2 border rounded">
                    <option value="Thiết bị chính">Thiết bị chính</option>
                    <option value="Vật tư đường dây">Vật tư đường dây</option>
                    <option value="Thiết bị đo lường">Thiết bị đo lường</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Hãng sản xuất</label>
                  <input type="text" value={formData.hangSx} onChange={e => setFormData({...formData, hangSx: e.target.value})} className="w-full px-3 py-2 border rounded" placeholder="VD: ABB, Dong Anh..." />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Model</label>
                  <input type="text" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Số Serial</label>
                  <input type="text" value={formData.serial} onChange={e => setFormData({...formData, serial: e.target.value})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Tổng số lượng</label>
                  <input type="number" value={formData.tongSoLuong} onChange={e => setFormData({...formData, tongSoLuong: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Đơn vị tính</label>
                  <input type="text" value={formData.donVi} onChange={e => setFormData({...formData, donVi: e.target.value})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Tuổi thọ thiết kế (Năm)</label>
                  <input type="number" value={formData.tuoiTho} onChange={e => setFormData({...formData, tuoiTho: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Link hình ảnh</label>
                  <div className="flex gap-2">
                    <input type="text" value={formData.hinhAnh} onChange={e => setFormData({...formData, hinhAnh: e.target.value})} className="flex-1 px-3 py-2 border rounded" />
                    <button className="p-2 bg-slate-100 rounded border hover:bg-slate-200"><ImageIcon size={18}/></button>
                  </div>
                </div>
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Ghi chú</label>
                  <textarea value={formData.ghiChu} onChange={e => setFormData({...formData, ghiChu: e.target.value})} className="w-full px-3 py-2 border rounded h-16" />
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t flex justify-end gap-3 shadow-inner">
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="px-6 py-2 border border-slate-300 rounded-md font-bold text-slate-500 hover:bg-slate-50 uppercase text-[11px]">Hủy bỏ</button>
              <button onClick={handleSave} className="px-10 py-2 bg-[#1e3a5f] text-white rounded-md font-bold flex items-center gap-2 hover:bg-slate-800 transition-all uppercase text-[11px] tracking-widest">
                <Save size={18}/> {editingId ? "Cập nhật hồ sơ kỹ thuật" : "Lưu hồ sơ kỹ thuật"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}