'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileSpreadsheet, Camera, Save, X, Calculator } from 'lucide-react';

interface OperatingEquipment {
  id: string;
  stt: number;
  asset: string;          // Cột 2
  assetId: string;        // Cột 3
  name: string;           // Cột 4
  quantity: number;       // Cột 5
  location: string;       // Cột 6
  wiring: string;         // Cột 7
  category: string;       // Cột 8
  phase: string;          // Cột 9 (1P/3P)
  voltage: string;        // Cột 10
  unit: string;           // Cột 11
  startDate: string;      // Cột 12 (Ngày lắp/quản lý)
  lastInspection: string; // Cột 13 (Ngày kiểm định gần nhất)
  nextInspection: string; // Tự động tính (Gần nhất + Chu kỳ)
  inspectionCycle: number;// Chu kỳ kiểm định (tháng)
  manager: string;        // Cột 14
  image?: string;         // Cột 15
  notes: string;          // Cột 16
}

export default function OperatingEquipmentPage() {
  const [equipments, setEquipments] = useState<OperatingEquipment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Bộ 4 ô nhập nhanh theo yêu cầu hình ảnh của bạn
  const [parts, setParts] = useState({ 
    type: '',     // Chủng loại
    phase: '',    // Phase (1P/3P)
    spec: '',     // Thông số chính
    volt: '',     // Cấp điện áp
    no: ''        // Số hiệu (cho Asset ID)
  });

  const [formData, setFormData] = useState<OperatingEquipment>({
    id: '', stt: 1, asset: '', assetId: '', name: '', quantity: 1,
    location: '', wiring: '', category: '', phase: '3P', voltage: '',
    unit: 'Cái', startDate: '', lastInspection: '', nextInspection: '',
    inspectionCycle: 48, manager: '', image: '', notes: ''
  });

  // 1. Logic Tự động ghép mã Asset và Tên thiết bị (ReadOnly)
  useEffect(() => {
    // Quy cách Asset: Chủng loại_Phase_Thông số chính_Cấp điện áp
    const assetStr = `${parts.type}_${parts.phase}_${parts.spec}_${parts.volt}`.replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
    
    // Quy cách Asset ID: [Asset]_[Số hiệu]
    const assetIdStr = parts.no ? `${assetStr}_${parts.no}` : assetStr;
    
    // Quy cách Tên thiết bị: Tên TV_Phase_Thông số chính_Cấp điện áp
    const nameStr = `${parts.type} ${parts.phase} ${parts.spec} ${parts.volt}kV`.trim();

    setFormData(prev => ({
      ...prev,
      asset: assetStr,
      assetId: assetIdStr,
      name: nameStr,
      category: parts.type,
      phase: parts.phase,
      voltage: parts.volt
    }));
  }, [parts]);

  // 2. Logic Tự động tính Ngày kiểm định tiếp theo
  useEffect(() => {
    if (formData.lastInspection && formData.inspectionCycle) {
      const lastDate = new Date(formData.lastInspection);
      lastDate.setMonth(lastDate.getMonth() + formData.inspectionCycle);
      setFormData(prev => ({
        ...prev,
        nextInspection: lastDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.lastInspection, formData.inspectionCycle]);

  const handleSave = () => {
    if (editId) {
      setEquipments(equipments.map(item => item.id === editId ? formData : item));
    } else {
      setEquipments([...equipments, { ...formData, id: Date.now().toString(), stt: equipments.length + 1 }]);
    }
    setShowForm(false);
    setParts({ type: '', phase: '', spec: '', volt: '', no: '' });
  };

  return (
    <div className="p-4 space-y-4 font-sans text-sm">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold text-[#1e3a5f] uppercase tracking-tight">Thiết bị vận hành trên lưới</h1>
        <button onClick={() => { setEditId(null); setShowForm(true); }} className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-800 transition-all font-bold">
          <Plus size={18} /> THÊM THIẾT BỊ
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[2000px]">
          <thead className="bg-[#1e3a5f] text-white text-[12px] uppercase">
            <tr>
              <th className="p-3 border border-slate-600 text-center">STT</th>
              <th className="p-3 border border-slate-600">Asset</th>
              <th className="p-3 border border-slate-600">Asset ID</th>
              <th className="p-3 border border-slate-600">Tên thiết bị</th>
              <th className="p-3 border border-slate-600 text-center">Số lượng</th>
              <th className="p-3 border border-slate-600">Vị trí lắp đặt</th>
              <th className="p-3 border border-slate-600">Đường dây</th>
              <th className="p-3 border border-slate-600 text-center">1P/3P</th>
              <th className="p-3 border border-slate-600 text-center">Cấp điện áp</th>
              <th className="p-3 border border-slate-600 text-center">Đơn vị</th>
              <th className="p-3 border border-slate-600">Ngày lắp/Quản lý</th>
              <th className="p-3 border border-slate-600">KĐ gần nhất</th>
              <th className="p-3 border border-slate-600 text-red-400">KĐ tiếp theo</th>
              <th className="p-3 border border-slate-600">Người phụ trách</th>
              <th className="p-3 border border-slate-600 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="text-[13px]">
            {equipments.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-200">
                <td className="p-3 text-center font-bold">{item.stt}</td>
                <td className="p-3">{item.asset}</td>
                <td className="p-3 font-mono font-bold text-blue-700">{item.assetId}</td>
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3 text-center">{item.quantity}</td>
                <td className="p-3">{item.location}</td>
                <td className="p-3">{item.wiring}</td>
                <td className="p-3 text-center">{item.phase}</td>
                <td className="p-3 text-center">{item.voltage}kV</td>
                <td className="p-3 text-center">{item.unit}</td>
                <td className="p-3">{item.startDate}</td>
                <td className="p-3">{item.lastInspection}</td>
                <td className="p-3 font-bold text-red-600">{item.nextInspection}</td>
                <td className="p-3">{item.manager}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <button onClick={() => { setEditId(item.id); setFormData(item); setShowForm(true); }} className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Edit2 size={16}/></button>
                    <button onClick={() => setEquipments(equipments.filter(e => e.id !== item.id))} className="text-red-600 p-1 hover:bg-red-50 rounded"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-blue-200">
            <div className="p-4 bg-[#1e3a5f] text-white flex justify-between items-center">
              <h2 className="font-bold flex items-center gap-2 uppercase tracking-widest"><Plus size={20}/> Nhập thông tin thiết bị vận hành</h2>
              <button onClick={() => setShowForm(false)} className="hover:rotate-90 transition-all"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-slate-50">
              {/* BỘ Ô NHẬP NHANH (Theo yêu cầu hình 1) */}
              <div className="grid grid-cols-5 gap-3 bg-white p-4 rounded-lg border border-blue-100 shadow-sm mb-6">
                <div className="col-span-5 flex items-center gap-2 text-blue-700 font-bold mb-1 border-b pb-2 uppercase text-xs">
                  <Calculator size={16}/> Công cụ tạo mã tự động (Nhập thông số lẻ tại đây)
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Chủng loại</label>
                  <input type="text" value={parts.type} onChange={e => setParts({...parts, type: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded focus:ring-2 ring-blue-500 outline-none" placeholder="MBA / DCL..." />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phase</label>
                  <select value={parts.phase} onChange={e => setParts({...parts, phase: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded bg-white">
                    <option value="">Chọn</option>
                    <option value="1P">1 Phase (1P)</option>
                    <option value="3P">3 Phase (3P)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thông số chính</label>
                  <input type="text" value={parts.spec} onChange={e => setParts({...parts, spec: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded" placeholder="630 / 100" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cấp điện áp (kV)</label>
                  <input type="text" value={parts.volt} onChange={e => setParts({...parts, volt: e.target.value})} className="w-full px-3 py-2 border border-blue-200 rounded" placeholder="22 / 35" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-red-600 uppercase mb-1">Số hiệu (ID)</label>
                  <input type="text" value={parts.no} onChange={e => setParts({...parts, no: e.target.value})} className="w-full px-3 py-2 border border-red-200 rounded font-bold" placeholder="01" />
                </div>
              </div>

              {/* CÁC TRƯỜNG DỮ LIỆU CHÍNH */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* NHÓM READ-ONLY (Không cho nhập trực tiếp) */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase">Asset (Tự động)</label>
                  <input type="text" value={formData.asset} readOnly className="w-full px-3 py-2 bg-slate-200 border border-slate-300 rounded font-semibold text-slate-600 cursor-not-allowed" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase">Asset ID (Tự động)</label>
                  <input type="text" value={formData.assetId} readOnly className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded font-mono font-bold text-blue-700 cursor-not-allowed" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-blue-900 uppercase">Tên thiết bị (Tự động)</label>
                  <input type="text" value={formData.name} readOnly className="w-full px-3 py-2 bg-slate-200 border border-slate-300 rounded font-bold text-slate-700 cursor-not-allowed" />
                </div>

                {/* NHÓM NHẬP TAY */}
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Vị trí lắp đặt</label>
                  <input type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} className="w-full px-3 py-2 border rounded" placeholder="Cột XYZ..." />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Đường dây</label>
                  <input type="text" value={formData.wiring} onChange={e => setFormData({...formData, wiring: e.target.value})} className="w-full px-3 py-2 border rounded" placeholder="471/E64" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Số lượng</label>
                  <input type="number" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Đơn vị tính</label>
                  <input type="text" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="w-full px-3 py-2 border rounded" placeholder="Cái / m / bộ" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Ngày lắp mới</label>
                  <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase">Người phụ trách</label>
                  <input type="text" value={formData.manager} onChange={e => setFormData({...formData, manager: e.target.value})} className="w-full px-3 py-2 border rounded" />
                </div>

                {/* NHÓM KIỂM ĐỊNH (Theo Hình 10) */}
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 col-span-1">
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">Ngày kiểm định gần nhất</label>
                  <input type="date" value={formData.lastInspection} onChange={e => setFormData({...formData, lastInspection: e.target.value})} className="w-full px-3 py-2 border border-amber-300 rounded" />
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 col-span-1">
                  <label className="block text-[11px] font-bold text-amber-800 uppercase mb-1">Chu kỳ KĐ (Tháng)</label>
                  <input type="number" value={formData.inspectionCycle} onChange={e => setFormData({...formData, inspectionCycle: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-amber-300 rounded" />
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200 col-span-1">
                  <label className="block text-[11px] font-bold text-red-800 uppercase mb-1">Ngày KĐ tiếp theo (Tự động)</label>
                  <input type="text" value={formData.nextInspection} readOnly className="w-full px-3 py-2 bg-white border border-red-300 rounded font-bold text-red-600" />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Ghi chú</label>
                  <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border rounded h-16" placeholder="Nhập ghi chú chi tiết..." />
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t flex justify-end gap-3 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
              <button onClick={() => setShowForm(false)} className="px-6 py-2 border border-slate-300 rounded-md font-bold text-slate-500 hover:bg-slate-50">HỦY BỎ</button>
              <button onClick={handleSave} className="px-10 py-2 bg-[#1e3a5f] text-white rounded-md font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg">
                <Save size={18}/> LƯU THÔNG TIN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}