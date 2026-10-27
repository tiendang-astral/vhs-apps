"use client";
import React, { useState, useRef, useEffect, lazy, Suspense } from "react";
import {
  Menu,
  LogOut,
  Package,
  Wrench,
  Calendar,
  Warehouse,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Building2,
  Users,
  Briefcase,
  Wallet,
  Truck,
  ShieldCheck,
  FileSpreadsheet,
  UserPlus,
  Award,
  KeyRound,
  Bell,
} from "lucide-react";

import { NotificationProvider, useNotification } from "./context/NotificationContext";
import { useAppContext, AppProvider } from "./context/AppProvider";

// Import các page
import LoginPage from "../page/authen/Login";
import TaskManagementPage from "../page/task/TaskManagementPage";
// Trang đăng nhập & trang nhiệm vụ (mặc định) tải ngay; các trang khác tải khi mở (code splitting)
const DashboardPage = lazy(() => import("../page/dashboard/Dashboard"));
const EquipmentAssetPage = lazy(() => import("../page/equipment/EquipmentAsset"));
const InventoryPage = lazy(() => import("../page/inventory/Inventory"));
const SpecificationsPage = lazy(() => import("../page/specification/Specifications"));
const OperatingEquipmentPage = lazy(() => import("../page/maintenance/OperatingEquipment"));
const CustomerManagementPage = lazy(() => import("../page/electric/CustomerManagement"));
const ElectricityPurchasePage = lazy(() => import("../page/electric/ElectricityPurchase"));
const RegisterUserPage = lazy(() => import("../page/authen/RegisterUserPage"));
const ChangePasswordPage = lazy(() => import("../page/authen/changePass"));
const EmployeeManagerPage = lazy(() => import("../page/authen/EmployeeManager"));
const LeaveManagementPage = lazy(() => import("../page/leave/LeaveManagementPage"));

// --- COMPONENT CHỨA LOGIC GIAO DIỆN ---
function AppContent() {
  const { user, setUser, currentPage, setCurrentPage } = useAppContext();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState<string[]>(["VNEB", "VHS", "admin-section"]);
  const [isLoadingAuth] = useState(false);
  const [activeDept, setActiveDept] = useState<{ id: string; name: string; companyId: string; } | null>(null);

  const menuStructure = [
    {
      id: "admin-section",
      label: "Quản trị hệ thống",
      icon: ShieldCheck,
      children: [{ id: "user-registration", label: "Cấp tài khoản", icon: UserPlus }],
    },
    {
      id: "VNEB",
      label: "Công ty VNEB",
      icon: Building2,
      children: [
        {
          id: "vneb-bod",
          label: "Ban Tổng Giám đốc",
          icon: Award,
          deptId: "4",
          accessRoles: ["CHAIRMAN", "BOD", "ADMIN"],
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        { id: "resignation", label: "Quản lý nghỉ phép", icon: Calendar },
        {
          id: "vneb-ketoan",
          label: "Phòng Tài chính-Kế toán",
          icon: Wallet,
          deptId: "12",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vneb-kythuat",
          label: "Phòng Kĩ thuật- Vận hành",
          deptId: "5",
          icon: Wrench,
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
            { id: "equipment", label: "Quản lý Xuất - Nhập", icon: Package },
            { id: "inventory", label: "Kho vật tư", icon: Warehouse },
            { id: "specifications", label: "Quản lý thiết bị", icon: Wrench },
            { id: "schedule", label: "Thiết bị vận hành", icon: Calendar },
          ],
        },
        {
          id: "vneb-kinhdoanh",
          label: "Phòng Kinh doanh điện",
          deptId: "3",
          icon: Users,
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
            { id: "customers", label: "Quản lý khách hàng", icon: Users },
            { id: "electricity", label: "Mua bán điện", icon: Package },
          ],
        },
      ],
    },
    {
      id: "VHS",
      label: "Công ty VHS",
      icon: Building2,
      children: [
        {
          id: "vhs-bod",
          label: "Ban Tổng Giám đốc",
          icon: Award,
          deptId: "4",
          accessRoles: ["CHAIRMAN", "BOD", "ADMIN"],
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        { id: "resignation", label: "Quản lý nghỉ phép", icon: Calendar },
        {
          id: "vhs-ketoan",
          label: "Phòng Tài chính-Kế toán",
          icon: Wallet,
          deptId: "6",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vhs-hcns",
          label: "Phòng HCNS",
          icon: Users,
          deptId: "7",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
            { id: "employee-manager", label: "Quản lý nhân sự", icon: Users },
          ],
        },
        {
          id: "vhs-kehoach",
          label: "Phòng Kế hoạch - Đầu tư",
          icon: Calendar,
          deptId: "2",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vhs-kythuat",
          label: "Phòng Kỹ thuật-Công nghệ",
          icon: Wrench,
          deptId: "8",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vhs-duan",
          label: "Phòng Quản lý dự án",
          icon: Briefcase,
          deptId: "9",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vhs-kinhdoanh",
          label: "Phòng Kinh doanh",
          icon: Users,
          deptId: "10",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
        {
          id: "vhs-logistics",
          label: "Phòng Logistics",
          icon: Truck,
          deptId: "11",
          children: [
            { id: "dept-dashboard", label: "Báo cáo Dashboard", icon: BarChart3 },
            { id: "task-registration", label: "Đăng ký nhiệm vụ", icon: FileSpreadsheet },
          ],
        },
      ],
    },
  ];

  const getFilteredMenu = (items: any[], parentDeptId: string | null = null, parentDeptName: string | null = null, parentId: string | null = null): any[] => {
    if (!user) return [];
    const role = user.role.toUpperCase();
    const userCompany = user.company.toUpperCase();
    return items.filter((item) => {
      if (item.id === "admin-section") return role === "ADMIN";
      if (item.id === "VNEB" || item.id === "VHS") return role === "ADMIN" || role === "CHAIRMAN" || userCompany === item.id;
      if (item.accessRoles) return item.accessRoles.includes(role);
      const currentId = item.deptId || parentDeptId;
      if (role !== "ADMIN" && role !== "CHAIRMAN" && role !== "BOD" && currentId) return currentId === user.deptId;
      return true;
    }).map((item) => {
      const currentDeptId = item.deptId || parentDeptId;
      const currentDeptName = item.deptId ? item.label : parentDeptName;
      const currentParentId = parentId || (item.id === "VNEB" || item.id === "VHS" ? item.id : null);
      if (item.children) return { ...item, deptId: currentDeptId, deptName: currentDeptName, parentCompanyId: currentParentId, children: getFilteredMenu(item.children, currentDeptId, currentDeptName, currentParentId) };
      return { ...item, deptId: currentDeptId, deptName: currentDeptName, parentCompanyId: currentParentId };
    });
  };

  const NavItem = ({ item, level = 0 }: { item: any; level?: number }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isOpen = openMenus.includes(item.id);
    const isSameDept = !item.deptId || activeDept?.id === item.deptId;
    const isSameCompany = !item.parentCompanyId || activeDept?.companyId === item.parentCompanyId;
    const isActive = currentPage === item.id && isSameDept && isSameCompany;
    return (
      <div key={item.id} className="w-full">
        <button
          onClick={() => {
            if (hasChildren) {
              setOpenMenus((prev) => prev.includes(item.id) ? prev.filter((i) => i !== item.id) : [...prev, item.id]);
            } else {
              setCurrentPage(item.id);
              if (item.deptId) { setActiveDept({ id: item.deptId, name: item.deptName || "Phòng ban", companyId: item.parentCompanyId }); }
            }
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${isActive ? "bg-blue-600 text-white font-medium shadow-lg" : "text-slate-300 hover:bg-slate-800"}`}
          style={{ paddingLeft: sidebarOpen ? `${(level + 1) * 12}px` : "16px" }}
        >
          <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
          {sidebarOpen && <span className="flex-1 text-left truncate">{item.label}</span>}
          {sidebarOpen && hasChildren && (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
        </button>
        {hasChildren && isOpen && sidebarOpen && (
          <div className="bg-slate-950/20">{item.children.map((child: any) => <NavItem key={child.id} item={child} level={level + 1} />)}</div>
        )}
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dept-dashboard": return <DashboardPage targetDeptId={activeDept?.id || user?.deptId} title={activeDept?.name || user?.deptName || "Báo cáo tổng hợp"} />;
      case "user-registration": return <RegisterUserPage />;
      case "equipment": return <EquipmentAssetPage />;
      case "inventory": return <InventoryPage />;
      case "specifications": return <SpecificationsPage />;
      case "schedule": return <OperatingEquipmentPage />;
      case "customers": return <CustomerManagementPage />;
      case "electricity": return <ElectricityPurchasePage />;
      case "change-password": return <ChangePasswordPage />;
      case "task-registration": return <TaskManagementPage targetDept={activeDept} />;
      case "employee-manager": return <EmployeeManagerPage />;
      case "resignation": return <LeaveManagementPage />;
      default: return <TaskManagementPage targetDept={activeDept} />;
    }
  };

const NotificationBell = () => {
  const { notifications, markAsRead } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null); // Ref để bắt vị trí chuông
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

const handleNotiClick = async (e: React.MouseEvent, noti: any) => {
  e.stopPropagation(); // Ngăn chặn sự kiện click lan tỏa (nếu có)
  
  if (!noti.isRead) {
    console.log("Đang gọi API markAsRead...");
    await markAsRead(noti.id); 
    console.log("API đã xong, chuẩn bị chuyển trang.");
  }
  
  // Sau khi await xong mới chuyển trang
  if (noti.link) {
    window.location.href = noti.link;
  }
  setIsOpen(false);
};
// Hàm tính toán lại vị trí
  const updatePosition = () => {
    if (isOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      const dropdownWidth = 320; // w-80 trong Tailwind tương đương 320px
      
      setPosition({
        top: rect.bottom + window.scrollY + 8, // Vẫn giữ khoảng cách dưới chuông
        // Tính tâm của chuông rồi trừ đi một nửa độ rộng của bảng (160px)
        left: rect.left + (rect.width / 2) - (dropdownWidth / 2)
      });
    }
  };
  // Cập nhật vị trí mỗi khi mở, cuộn trang hoặc resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      {/* 1. Gán ref vào đây để xác định tọa độ */}
      <div 
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)} 
        className="cursor-pointer p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
      >
        <Bell size={20} className="text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border border-slate-900">
            {unreadCount}
          </span>
        )}
      </div>

      {/* 2. Style động dựa trên tính toán JS */}
      {isOpen && (
        <div 
          className="fixed w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-[9999] overflow-hidden flex flex-col max-h-[80vh]"
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
        >
          {/* Header */}
          <div className="p-3 border-b border-slate-100 font-bold text-sm text-slate-700 shrink-0">
            Thông báo ({notifications.length})
          </div>
          
          {/* 3. Đảm bảo list thông báo có thể cuộn được */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">Không có thông báo mới</div>
            ) : (
              notifications.map((noti: any) => (
                <div 
                  key={noti.id} 
                  // Click gọi handleNotiClick
                  className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition ${!noti.isRead ? 'bg-blue-50/50' : ''}`}
                  onClick={(e) => handleNotiClick(e, noti)}
                >
                  <p className="text-sm text-slate-800 font-medium">{noti.content}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(noti.createdAt).toLocaleString('vi-VN')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

  if (isLoadingAuth) return <div className="h-screen bg-slate-900 flex items-center justify-center text-white">Đang tải...</div>;
  if (!user) return <LoginPage />;

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      <aside className={`${sidebarOpen ? "w-64" : "w-20"} bg-slate-900 text-white transition-all duration-300 flex flex-col z-30`}>
        {/* TOP SECTION: User Profile & Notification */}
        <div className="p-4 border-b border-slate-800 space-y-4">
          <div className={`flex items-center ${sidebarOpen ? "gap-3" : "justify-center"}`}>
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl shrink-0">V</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0 overflow-hidden">
                <p className="font-bold text-white truncate text-sm">{user.name}</p>
                <p className="text-blue-400 text-[10px] font-black uppercase truncate">{user.company} • {user.role}</p>
              </div>
            )}
            {sidebarOpen && <NotificationBell />}
          </div>
          {!sidebarOpen && <div className="flex justify-center"><NotificationBell /></div>}
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {getFilteredMenu(menuStructure).map((item) => <NavItem key={item.id} item={item} />)}
        </nav>

        {/* BOTTOM SECTION */}
        <div className="border-t border-slate-800 p-4 space-y-2">
          {sidebarOpen && (
            <button onClick={() => setCurrentPage("change-password")} className={`w-full flex items-center gap-3 px-4 py-2 text-sm rounded-xl transition-colors ${currentPage === "change-password" ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
              <KeyRound size={16} /> Đổi mật khẩu
            </button>
          )}
          <button onClick={() => { localStorage.clear(); setUser(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-400 hover:text-white hover:bg-red-600/20 rounded-xl transition-all">
            <LogOut className="w-4 h-4 text-red-500" />
            {sidebarOpen && <span className="text-sm font-bold">Đăng xuất</span>}
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-full flex items-center justify-center p-2 text-slate-600 hover:text-white mt-2"><Menu size={20} /></button>
        </div>
      </aside>

      {/* HEADER: NotificationBell đã được xóa khỏi đây */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shadow-sm z-20">
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">Daily Work tasks</h1>
          {activeDept && (
             <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase border border-blue-100 flex items-center gap-2">
               <Building2 size={12} /> {activeDept.name}
             </div>
          )}
        </header>
        <main className="flex-1 overflow-auto p-8 bg-[#F8FAFC]">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-32 text-slate-400 text-sm font-bold">
                Đang tải...
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AppProvider>
  );
}