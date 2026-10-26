import React, { useEffect, useState, ChangeEvent } from "react";
import {
  User, Edit, FileText, Phone, Mail, Briefcase, CreditCard, ShieldCheck,
  Search, X, Building2, Calendar, MapPin, Fingerprint, GraduationCap,
  Clock, Landmark, Wallet, DollarSign, Receipt, Paperclip, Download, Filter, Camera,
  Trash2 // Thêm icon Xóa
} from "lucide-react";
import { authenApi } from "../authen/authenApi";
import { rootApi } from "../api/rootApi"; 
import Swal from "sweetalert2";

// --- COMPONENT HỖ TRỢ (GIỮ NGUYÊN) ---

const InputField = ({ label, name, type = "text", icon: Icon, value, onChange }: any) => {
  const formatDate = (dateStr: string) => (dateStr ? dateStr.split("T")[0] : "");
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black uppercase text-slate-400 ml-1 flex items-center gap-1">
        {Icon && <Icon size={10} />} {label}
      </label>
      <input
        type={type}
        name={name}
        value={type === "date" ? formatDate(value) : value || ""}
        onChange={onChange}
        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-semibold text-slate-700 transition-all"
      />
    </div>
  );
};

const FormSection = ({ title, icon: Icon, children, id }: any) => (
  <div id={id} className="mb-12 scroll-mt-28">
    <div className="flex items-center gap-3 mb-6 pb-2 border-b-2 border-slate-100">
      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
        <Icon size={18} />
      </div>
      <h4 className="text-sm font-black uppercase tracking-widest text-slate-700 italic">
        {title}
      </h4>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {children}
    </div>
  </div>
);

// --- COMPONENT CHÍNH ---

const EmployeeManagerPage = () => {
  const host = rootApi.defaults.baseURL?.split('/api')[0];

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [searchText, setSearchText] = useState("");
  
  const [filterDept, setFilterDept] = useState("");
  const [filterCompany, setFilterCompany] = useState("");

  // Lấy role từ localStorage để phân quyền nút xóa
  const currentUserRole = localStorage.getItem("role");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await authenApi.getAllUsers();
      if (res.data.code === 200) setUsers(res.data.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  const departments = Array.from(new Set(users.map((u) => u.departmentName || u.department?.name).filter(Boolean)));
  const companies = Array.from(new Set(users.map((u) => u.company).filter(Boolean)));

  const handleEdit = async (id: string) => {
    try {
      const res = await authenApi.getById(id);
      if (res.data.code === 200) {
        setEditingUser(res.data.data);
        setIsModalOpen(true);
      }
    } catch (err) { Swal.fire("Lỗi", "Không thể lấy thông tin", "error"); }
  };

  // --- HÀM XỬ LÝ XÓA (MỚI THÊM) ---
  const handleDelete = async (id: string, name: string) => {
    Swal.fire({
      title: "Xác nhận xóa?",
      text: `Dữ liệu của ${name.toUpperCase()} sẽ bị xóa vĩnh viễn khỏi hệ thống!`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Xóa ngay",
      cancelButtonText: "Hủy"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await authenApi.deleteUser(id);
          if (res.data.code === 200) {
            Swal.fire("Thành công", "Đã xóa nhân sự", "success");
            fetchUsers();
          }
        } catch (err) {
          Swal.fire("Lỗi", "Không thể xóa nhân sự này", "error");
        }
      }
    });
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditingUser((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    if (!filePath) { Swal.fire("Thông báo", "Chưa có file.", "info"); return; }
    try {
      const response = await authenApi.downloadContract(filePath);
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName || "document");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) { Swal.fire("Lỗi", "Tải thất bại", "error"); }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser?.id) return;
    try {
      Swal.fire({ title: "Đang tải lên...", didOpen: () => Swal.showLoading() });
      const res = await authenApi.uploadContract(file, editingUser.id, type);
      if (res.data.code === 200) {
        setEditingUser((prev: any) => ({ ...prev, [`officialContractFile${type}`]: res.data.data }));
        Swal.fire("Thành công", "Đã cập nhật file", "success");
      }
    } catch (err) { Swal.fire("Lỗi", "Tải lên thất bại", "error"); }
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser?.id) return;
    try {
      Swal.fire({ title: "Đang cập nhật...", didOpen: () => Swal.showLoading() });
      const res = await (authenApi as any).uploadAvatar(file, editingUser.id);
      if (res.data.code === 200) {
        setEditingUser((prev: any) => ({ ...prev, avatarPath: res.data.data }));
        Swal.fire("Thành công", "Đã đổi ảnh đại diện", "success");
        fetchUsers();
      }
    } catch (err) { Swal.fire("Lỗi", "Tải lên thất bại", "error"); }
  };

  const handleSave = async () => {
    try {
      const res = await authenApi.updateInfo(editingUser);
      if (res.data.code === 200) {
        Swal.fire("Thành công", "Hồ sơ đã được lưu", "success");
        setIsModalOpen(false);
        fetchUsers();
      }
    } catch (err) { Swal.fire("Lỗi", "Cập nhật thất bại", "error"); }
  };

  const filteredUsers = users.filter((u: any) => {
    const matchesSearch = u.fullName?.toLowerCase().includes(searchText.toLowerCase()) || u.username?.toLowerCase().includes(searchText.toLowerCase());
    const uDept = u.departmentName || u.department?.name || "";
    const matchesDept = filterDept === "" || uDept === filterDept;
    const matchesCompany = filterCompany === "" || u.company === filterCompany;
    return matchesSearch && matchesDept && matchesCompany;
  });

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="p-4 animate-in fade-in duration-500">
      
      {/* --- HEADER & BỘ LỌC --- */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3 uppercase italic">
            <div className="p-2 bg-blue-600 text-white rounded-xl"><User size={24} /></div>
            Hồ sơ nhân sự toàn hệ thống
          </h2>
          <p className="text-slate-400 text-xs font-bold mt-1 tracking-widest uppercase">Quản lý tập trung dữ liệu VNEB - VHS</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative">
            <select
              className="pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-black uppercase text-slate-600 outline-none focus:border-blue-500 appearance-none min-w-[160px]"
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
            >
              <option value="">Tất cả công ty</option>
              {companies.map((c: any) => <option key={c} value={c}>{c}</option>)}
            </select>
            <Building2 size={14} className="absolute right-4 top-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              className="pl-4 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-[11px] font-black uppercase text-slate-600 outline-none focus:border-blue-500 appearance-none min-w-[160px]"
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((d: any) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Filter size={14} className="absolute right-4 top-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative group flex-1 lg:flex-none">
            <Search className="absolute left-4 top-3 text-slate-400 group-focus-within:text-blue-600" size={20} />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc tài khoản..."
              className="pl-12 pr-6 py-3 border-2 border-slate-100 rounded-2xl focus:border-blue-500 w-full lg:w-72 text-sm font-medium bg-slate-50"
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* --- BẢNG DỮ LIỆU --- */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-800 text-white font-bold uppercase text-[10px] tracking-[0.2em]">
              <tr>
                <th className="px-6 py-5">Nhân viên</th>
                <th className="px-6 py-5">Tài khoản</th>
                <th className="px-6 py-5">Số điện thoại</th>
                <th className="px-6 py-5">Công ty</th>
                <th className="px-6 py-5">Phòng ban</th>
                <th className="px-6 py-5">Chức vụ</th>
                <th className="px-6 py-5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-blue-50/50 transition-all group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black group-hover:border-blue-400 border-2 border-transparent transition-all overflow-hidden">
                        {user.avatarPath ? (
                          <img src={`${host}/${user.avatarPath}`} alt="" className="w-full h-full object-cover" onError={(e: any) => { e.target.src = `https://ui-avatars.com/api/?name=${user.fullName}`; }} />
                        ) : (
                          <span className="text-slate-400 text-xs">{user.fullName?.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <div className="font-black text-slate-700 uppercase italic text-sm">{user.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">ID: {user.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 font-bold text-slate-500 text-sm">{user.username}</td>
                  <td className="px-6 py-5 font-bold text-slate-600 text-sm">
                    <div className="flex items-center gap-2"><Phone size={12} className="text-slate-400" />{user.phoneNumber || "---"}</div>
                  </td>
                  <td className="px-6 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">{user.company || "N/A"}</span></td>
                  <td className="px-6 py-5 font-bold text-blue-600 text-xs uppercase italic">{user.departmentName || user.department?.name || "Chưa gán"}</td>
                  <td className="px-6 py-5 text-slate-500 font-medium italic">{user.position || "Nhân viên"}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(user.id)} className="bg-slate-100 text-slate-600 p-2.5 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95">
                        <Edit size={18} />
                      </button>
                      
                      {/* Nút Xóa có phân quyền CHAIRMAN */}
                      {currentUserRole === "CHAIRMAN" && (
                        <button onClick={() => handleDelete(user.id, user.fullName)} className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">Không tìm thấy kết quả phù hợp</div>
        )}
      </div>

      {/* --- MODAL (GIỮ NGUYÊN TOÀN BỘ) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
            
            <div className="px-10 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div className="flex items-center gap-5">
                <div className="relative group">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg overflow-hidden border-2 border-white">
                    {editingUser?.avatarPath ? (
                       <img src={`${host}/${editingUser.avatarPath}`} className="w-full h-full object-cover" alt="" />
                    ) : (editingUser?.fullName?.charAt(0))}
                  </div>
                  <label className="absolute -bottom-1 -right-1 p-1.5 bg-white text-blue-600 rounded-lg shadow-md border border-slate-100 cursor-pointer hover:bg-blue-600 hover:text-white transition-all">
                    <Camera size={14} />
                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                  </label>
                </div>

                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase italic tracking-wider">{editingUser?.fullName}</h3>
                  <div className="flex gap-4">
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded uppercase">{editingUser?.role}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mã NV: {editingUser?.id}</span>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                <button onClick={() => scrollToSection('sec-personal')} className="px-4 py-2 text-[10px] font-black uppercase hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-xl transition-all">1. Cá nhân</button>
                <button onClick={() => scrollToSection('sec-work')} className="px-4 py-2 text-[10px] font-black uppercase hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-xl transition-all">2. Công tác</button>
                <button onClick={() => scrollToSection('sec-contract')} className="px-4 py-2 text-[10px] font-black uppercase hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-xl transition-all">3. Hợp đồng</button>
                <button onClick={() => scrollToSection('sec-finance')} className="px-4 py-2 text-[10px] font-black uppercase hover:bg-white hover:text-blue-600 hover:shadow-sm rounded-xl transition-all">4. Tài chính</button>
              </div>

              <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center hover:bg-red-50 hover:text-red-500 rounded-xl text-slate-300 transition-all active:scale-90">
                <X size={28} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 bg-white custom-scrollbar space-y-4">
              <FormSection id="sec-personal" title="Thông tin cá nhân cơ bản" icon={User}>
                <div className="col-span-2">
                  <InputField label="Họ tên đầy đủ" name="fullName" icon={User} value={editingUser?.fullName} onChange={handleInputChange} />
                </div>
                <div className="col-span-2">
                  <InputField label="Email cá nhân" name="email" icon={Mail} value={editingUser?.email} onChange={handleInputChange} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Giới tính</label>
                  <select name="gender" value={editingUser?.gender || ""} onChange={handleInputChange} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 transition-all">
                    <option value="">Chọn...</option>
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
                <InputField label="Ngày sinh" name="birthday" type="date" icon={Calendar} value={editingUser?.birthday} onChange={handleInputChange} />
                <InputField label="Dân tộc" name="ethnic" value={editingUser?.ethnic} onChange={handleInputChange} />
                <InputField label="Số điện thoại" name="phoneNumber" icon={Phone} value={editingUser?.phoneNumber} onChange={handleInputChange} />
                <InputField label="Số CCCD" name="idCardNumber" icon={Fingerprint} value={editingUser?.idCardNumber} onChange={handleInputChange} />
                <InputField label="Ngày cấp" name="idCardIssuedDate" type="date" value={editingUser?.idCardIssuedDate} onChange={handleInputChange} />
                <InputField label="Nơi cấp" name="idCardIssuedPlace" value={editingUser?.idCardIssuedPlace} onChange={handleInputChange} />
                <div className="col-span-4">
                  <InputField label="Địa chỉ thường trú" name="permanentAddress" icon={MapPin} value={editingUser?.permanentAddress} onChange={handleInputChange} />
                </div>
              </FormSection>

              <FormSection id="sec-work" title="Công tác & Chức vụ" icon={Briefcase}>
                <InputField label="Pháp nhân ký HĐ" name="company" icon={Building2} value={editingUser?.company} onChange={handleInputChange} />
                <InputField label="Chức danh/Chức vụ" name="position" icon={Briefcase} value={editingUser?.position} onChange={handleInputChange} />
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Bộ phận/Phòng ban</label>
                  <input value={editingUser?.department?.name || editingUser?.departmentName || "N/A"} readOnly className="w-full px-4 py-2 bg-blue-50 border border-blue-100 text-blue-700 rounded-xl text-sm font-bold outline-none cursor-not-allowed" />
                </div>
                <InputField label="Trình độ học vấn" name="educationLevel" icon={GraduationCap} value={editingUser?.educationLevel} onChange={handleInputChange} />
                <InputField label="Trường đào tạo" name="school" value={editingUser?.school} onChange={handleInputChange} />
                <InputField label="Chuyên ngành" name="major" value={editingUser?.major} onChange={handleInputChange} />
                <InputField label="Ngày vào làm" name="joinDate" type="date" icon={Clock} value={editingUser?.joinDate} onChange={handleInputChange} />
                <InputField label="Ngày bắt đầu thử việc" name="probationStartDate" type="date" value={editingUser?.probationStartDate} onChange={handleInputChange} />
                <InputField label="Ngày kết thúc thử việc" name="probationEndDate" type="date" value={editingUser?.probationEndDate} onChange={handleInputChange} />
              </FormSection>

              <FormSection id="sec-contract" title="Hợp đồng & Pháp lý" icon={ShieldCheck}>
                <div className="col-span-2">
                  <InputField label="Loại hợp đồng lao động" name="contractType" icon={FileText} value={editingUser?.contractType} onChange={handleInputChange} />
                </div>
                <InputField label="Mã số thuế" name="taxCode" icon={Receipt} value={editingUser?.taxCode} onChange={handleInputChange} />
                <InputField label="Mã số BHXH" name="insuranceCode" icon={ShieldCheck} value={editingUser?.insuranceCode} onChange={handleInputChange} />
                <div className="col-span-4 grid grid-cols-3 gap-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="col-span-3 text-[11px] font-black uppercase text-blue-600 mb-2 tracking-widest">Hợp đồng chính thức & Đính kèm</div>
                  {["1", "2", "3"].map((num) => (
                    <div key={num} className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3 shadow-sm">
                      <InputField label={`HĐ lần ${num}`} name={`officialContractDate${num}`} type="date" value={editingUser?.[`officialContractDate${num}`]} onChange={handleInputChange} />
                      <button disabled={!editingUser?.[`officialContractFile${num}`]} onClick={() => handleDownload(editingUser?.[`officialContractFile${num}`], "")} className="w-full py-2 bg-slate-100 text-[10px] font-black uppercase rounded-lg hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-sm">
                        <Download size={14} /> Tải HĐ {num}
                      </button>
                      <label className="w-full py-2 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded-lg text-center cursor-pointer hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1 border border-blue-100 shadow-sm">
                        <Paperclip size={12} /> Tải lên mới
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, num)} />
                      </label>
                    </div>
                  ))}
                </div>
              </FormSection>

              <FormSection id="sec-finance" title="Tài chính & Giải ngân" icon={CreditCard}>
                <InputField label="Mức lương thử việc" name="probationSalary" type="number" icon={DollarSign} value={editingUser?.probationSalary} onChange={handleInputChange} />
                <InputField label="Mức lương chính thức" name="officialSalary" type="number" icon={DollarSign} value={editingUser?.officialSalary} onChange={handleInputChange} />
                <InputField label="Lương đóng BHXH (BĐ)" name="insuranceSalaryStart" type="number" icon={Wallet} value={editingUser?.insuranceSalaryStart} onChange={handleInputChange} />
                <InputField label="Lương đóng BHXH (HT)" name="insuranceSalaryCurrent" type="number" value={editingUser?.insuranceSalaryCurrent} onChange={handleInputChange} />
                <div className="col-span-2">
                  <InputField label="Tên ngân hàng" name="bankName" icon={Landmark} value={editingUser?.bankName} onChange={handleInputChange} />
                </div>
                <div className="col-span-2">
                  <InputField label="Số tài khoản ngân hàng" name="bankAccountNumber" icon={CreditCard} value={editingUser?.bankAccountNumber} onChange={handleInputChange} />
                </div>
              </FormSection>
            </div>

            <div className="px-10 py-6 border-t border-slate-100 flex justify-end gap-4 bg-white sticky bottom-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
              <button onClick={() => setIsModalOpen(false)} className="px-8 py-3 rounded-2xl font-bold text-slate-400 hover:bg-slate-50 transition-all text-xs uppercase tracking-[0.2em]">Hủy bỏ</button>
              <button onClick={handleSave} className="px-12 py-3 rounded-2xl font-black bg-blue-600 text-white hover:bg-blue-700 shadow-2xl shadow-blue-200 transition-all text-xs uppercase italic tracking-[0.1em] active:scale-95">Cập nhật toàn bộ hồ sơ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagerPage;