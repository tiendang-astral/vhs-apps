"use client";
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  Save,
  Send,
  Plus,
  Trash2,
  Loader2,
  PlusCircle,
  User,
  AlertTriangle,
  X,
} from "lucide-react";
import { useAppContext } from "../../app/context/AppProvider";
import { taskApi } from "../task/TaskApi";

// ============================================================================
// TYPES & HẰNG SỐ
// ============================================================================
interface TaskItem {
  id?: string;
  taskDescription: string;
  startDate: string;
  endDate: string;
  expectedOutcome: string;
  personalTarget: string;
  managerTarget: string;
  personalResult: string;
  managerResult: string;
  personalPriority: string;
  managerPriority: string;
  personalComplexity: string;
  managerComplexity: string;
  note: string;
}

type Category = "A" | "B" | "C";

interface TaskSection {
  id?: string;
  category: Category;
  sectionName: string;
  taskItems: TaskItem[];
}

interface MonthlyTaskRegistrationProps {
  targetUserId?: string;
  targetMonth?: string;
}

type TaskField = keyof TaskItem;
type UpdateTaskFn = (sIdx: number, tIdx: number, field: TaskField, value: string) => void;

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "A", label: "Nhiệm vụ trọng tâm" },
  { key: "B", label: "Nhiệm vụ bổ sung" },
  { key: "C", label: "Nhiệm vụ phát sinh" },
];

const PRIORITY_OPTIONS = [
  { value: "High", label: "Cao" },
  { value: "Medium", label: "T.Bình" },
  { value: "Low", label: "Thấp" },
];

const COMPLEXITY_OPTIONS = [
  { value: "Complex", label: "P.Tạp" },
  { value: "Normal", label: "B.Thường" },
  { value: "Simple", label: "D.Giản" },
];

const PERCENT_FIELDS = new Set<TaskField>([
  "personalTarget",
  "managerTarget",
  "personalResult",
  "managerResult",
]);

const APPROVER_ROLES = new Set(["ADMIN", "CHAIRMAN"]);

const createEmptyTask = (): TaskItem => ({
  taskDescription: "",
  startDate: "",
  endDate: "",
  expectedOutcome: "",
  personalTarget: "100%",
  managerTarget: "",
  personalResult: "",
  managerResult: "",
  personalPriority: "Medium",
  managerPriority: "Medium",
  personalComplexity: "Normal",
  managerComplexity: "Normal",
  note: "",
});

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

// Chuẩn hóa giá trị phần trăm: "80" -> "80%"
const normalizePercent = (value: string) => {
  const numericValue = value.replace(/%/g, "").trim();
  return numericValue !== "" && !isNaN(Number(numericValue))
    ? `${numericValue}%`
    : value;
};

// ============================================================================
// MODAL XÁC NHẬN
// ============================================================================
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "primary" | "danger" | "warning";
}

const MODAL_STYLES = {
  danger: { bg: "bg-red-100", text: "text-red-600", btn: "bg-red-600 hover:bg-red-700" },
  warning: { bg: "bg-orange-100", text: "text-orange-600", btn: "bg-orange-600 hover:bg-orange-700" },
  primary: { bg: "bg-blue-100", text: "text-blue-600", btn: "bg-blue-600 hover:bg-blue-700" },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  type = "primary",
}) => {
  if (!isOpen) return null;
  const styles = MODAL_STYLES[type];

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-500/75 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden transform animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${styles.bg}`}
            >
              <AlertTriangle className={styles.text} size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-500">{message}</p>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3">
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-bold text-white shadow-sm transition-all active:scale-95 ${styles.btn}`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-bold text-slate-700 border bg-white hover:bg-slate-50"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 1 DÒNG NHIỆM VỤ (memo: chỉ render lại dòng đang được sửa thay vì cả bảng)
// ============================================================================
interface TaskRowProps {
  task: TaskItem;
  sIdx: number; // vị trí hạng mục trong mảng taskSections
  tIdx: number; // vị trí nhiệm vụ trong hạng mục
  sectionNumber: number; // STT hiển thị
  sectionName: string;
  rowSpan: number;
  canEditGeneral: boolean;
  canEditResults: boolean;
  deleteMode: "none" | "normal" | "chairman";
  onUpdateTask: UpdateTaskFn;
  onUpdateSectionName: (sIdx: number, value: string) => void;
  onAddTask: (sIdx: number) => void;
  onRemoveTask: (sIdx: number, tIdx: number) => void;
}

const TaskRow = memo(function TaskRow({
  task,
  sIdx,
  tIdx,
  sectionNumber,
  sectionName,
  rowSpan,
  canEditGeneral,
  canEditResults,
  deleteMode,
  onUpdateTask,
  onUpdateSectionName,
  onAddTask,
  onRemoveTask,
}: TaskRowProps) {
  const bind = (field: TaskField) => ({
    value: (task[field] as string) || "",
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
    ) => onUpdateTask(sIdx, tIdx, field, e.target.value),
  });

  return (
    <tr className="hover:bg-blue-50/50 transition-colors border-b border-slate-100">
      {tIdx === 0 && (
        <>
          <td
            rowSpan={rowSpan}
            className="border text-center font-bold text-slate-400 bg-white"
          >
            {sectionNumber}
          </td>
          <td rowSpan={rowSpan} className="border p-3 bg-white align-top">
            <textarea
              className="w-full font-bold text-red-600 outline-none bg-transparent resize-none"
              value={sectionName}
              disabled={!canEditGeneral}
              onChange={(e) => onUpdateSectionName(sIdx, e.target.value)}
            />
            {canEditGeneral && (
              <button
                onClick={() => onAddTask(sIdx)}
                className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-2"
              >
                <PlusCircle size={14} /> Thêm việc
              </button>
            )}
          </td>
        </>
      )}
      <td className="border p-1">
        <textarea
          className="w-full outline-none bg-transparent resize-none"
          rows={2}
          disabled={!canEditGeneral}
          {...bind("taskDescription")}
        />
      </td>
      <td className="border p-1 bg-blue-50/30">
        <textarea
          className="w-full outline-none bg-transparent resize-none italic text-blue-800"
          rows={2}
          placeholder="Ví dụ: Đối tác đánh giá khả thi..."
          disabled={!canEditGeneral}
          {...bind("expectedOutcome")}
        />
      </td>
      <td className="border p-1 text-center">
        <input
          type="date"
          className="w-full bg-transparent text-center outline-none"
          disabled={!canEditGeneral}
          {...bind("startDate")}
        />
      </td>
      <td className="border p-1 text-center">
        <input
          type="date"
          className="w-full bg-transparent text-center outline-none"
          disabled={!canEditGeneral}
          {...bind("endDate")}
        />
      </td>
      <td className="border p-1">
        <input
          className="w-full text-center bg-transparent outline-none"
          disabled={!canEditGeneral}
          {...bind("personalTarget")}
        />
      </td>
      <td className="border p-1 bg-orange-50/30">
        <input
          className="w-full text-center bg-transparent font-bold text-orange-700 outline-none"
          disabled={!canEditResults}
          {...bind("managerTarget")}
        />
      </td>
      <td className="border p-1">
        <input
          className="w-full text-center bg-transparent outline-none"
          disabled={!canEditGeneral}
          {...bind("personalResult")}
        />
      </td>
      <td className="border p-1 bg-orange-50/30">
        <input
          className="w-full text-center bg-transparent font-bold text-orange-700 outline-none"
          disabled={!canEditResults}
          {...bind("managerResult")}
        />
      </td>
      <td className="border p-1">
        <select
          className="w-full bg-transparent outline-none"
          disabled={!canEditGeneral}
          {...bind("personalPriority")}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="border p-1 bg-orange-50/30 text-orange-700 font-bold">
        <select
          className="w-full bg-transparent outline-none"
          disabled={!canEditResults}
          {...bind("managerPriority")}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="border p-1">
        <select
          className="w-full bg-transparent outline-none"
          disabled={!canEditGeneral}
          {...bind("personalComplexity")}
        >
          {COMPLEXITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="border p-1 bg-orange-50/30 text-orange-700 font-bold">
        <select
          className="w-full bg-transparent outline-none"
          disabled={!canEditResults}
          {...bind("managerComplexity")}
        >
          {COMPLEXITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </td>
      <td className="border p-1 bg-orange-50/30 text-orange-700 font-bold">
        <textarea
          className="w-full bg-transparent outline-none text-[11px] text-slate-500 italic resize-none"
          placeholder="Ghi chú nhiệm vụ..."
          rows={2}
          disabled={!canEditGeneral}
          {...bind("note")}
        />
      </td>
      <td className="text-center border p-1">
        {deleteMode !== "none" && (
          <button
            onClick={() => onRemoveTask(sIdx, tIdx)}
            className={
              deleteMode === "chairman"
                ? "text-red-400 hover:text-red-600 transition-colors"
                : "text-slate-300 hover:text-red-500 transition-colors"
            }
          >
            <Trash2 size={16} />
          </button>
        )}
      </td>
    </tr>
  );
});

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
export default function MonthlyTaskRegistration({
  targetUserId,
  targetMonth,
}: MonthlyTaskRegistrationProps) {
  const { user }: any = useAppContext();
  const activeUserId =
    targetUserId || user?.id || localStorage.getItem("userId");

  const [targetUserRole, setTargetUserRole] = useState("");
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [taskSections, setTaskSections] = useState<TaskSection[]>([]);
  // Trước đây mặc định cứng "2026-03" khi không truyền tháng
  const [month, setMonth] = useState(() => targetMonth || getCurrentMonth());
  const [status, setStatus] = useState("DRAFT");
  const [employeeName, setEmployeeName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState({
    show: false,
    msg: "",
    type: "success" as "success" | "error",
  });
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: "primary" as "primary" | "danger" | "warning",
    title: "",
    message: "",
    confirmText: "ĐỒNG Ý",
    cancelText: "HỦY BỎ",
    action: null as (() => void) | null,
  });

  // Đồng bộ khi component cha đổi tháng
  useEffect(() => {
    if (targetMonth) setMonth(targetMonth);
  }, [targetMonth]);

  // Toast: hủy timer cũ / khi unmount để tránh setState trên component đã hủy
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const notify = useCallback((msg: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setShowToast({ show: true, msg, type });
    toastTimer.current = setTimeout(
      () => setShowToast({ show: false, msg: "", type: "success" }),
      3000,
    );
  }, []);

  // ---------------------------------------------------------------- LOAD DATA
  useEffect(() => {
    if (!activeUserId) return;
    let cancelled = false; // bỏ qua response cũ khi người dùng đổi tháng liên tục

    const fetchData = async () => {
      setLoading(true);
      try {
        const res: any = await taskApi.getByUserAndMonth(activeUserId, month);
        if (cancelled) return;
        if (res.data?.code === 200 && res.data.data) {
          const d = res.data.data;
          setRegistrationId(d.id || null);
          setTaskSections(Array.isArray(d.taskSections) ? d.taskSections : []);
          setStatus(d.status || "DRAFT");
          setTargetUserRole((d.user?.role || "STAFF").toUpperCase());
          setEmployeeName(d.user?.fullName || d.fullName || "");
        } else {
          setRegistrationId(null);
          setTaskSections([]);
          setStatus("DRAFT");
        }
      } catch (e) {
        if (!cancelled) {
          setTaskSections([]);
          notify("Không tải được dữ liệu nhiệm vụ", "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();

    return () => {
      cancelled = true;
    };
  }, [month, activeUserId, notify]);

  // ---------------------------------------------------------------- PHÂN QUYỀN
  const myRole = (user?.role || "").toUpperCase();

  const { canEditGeneral, canEditResults, isApproverMode } = useMemo(() => {
    const targetRole = (targetUserRole || "").toUpperCase();
    const isOwner = String(user?.id) === String(activeUserId);

    let hasPermissionToEditQL = false;
    if (!isOwner) {
      hasPermissionToEditQL =
        APPROVER_ROLES.has(myRole) ||
        (myRole === "BOD" && targetRole === "MANAGER") ||
        (myRole === "MANAGER" && targetRole === "STAFF");
    }

    return {
      canEditGeneral: isOwner || hasPermissionToEditQL,
      canEditResults: hasPermissionToEditQL,
      isApproverMode: !isOwner && hasPermissionToEditQL,
    };
  }, [user?.id, myRole, activeUserId, targetUserRole]);

  const deleteMode: TaskRowProps["deleteMode"] =
    status === "APPROVED"
      ? myRole === "CHAIRMAN"
        ? "chairman"
        : "none"
      : canEditGeneral
        ? "normal"
        : "none";

  // ---------------------------------------------------------------- LƯU
  // Gọi API lưu, trả về id bản đăng ký (hoặc null nếu lỗi). Không tự bật/tắt loading.
  const persist = async (newStatus?: string): Promise<string | null> => {
    const payload = {
      id: registrationId,
      userId: activeUserId,
      month,
      status: newStatus || status,
      taskSections,
    };
    const res: any = await taskApi.saveTasks(payload);
    if (res.data?.code !== 200) {
      notify(res.data?.message || "Lưu thất bại", "error");
      return null;
    }
    // Backend trả về Data = Id (chuỗi). Trước đây đọc data.id nên luôn undefined
    // => bản đăng ký mới tạo không thể Phê duyệt ngay.
    const returned = res.data.data;
    const newId: string | null =
      typeof returned === "string" ? returned : returned?.id ?? registrationId;
    if (newId) setRegistrationId(newId);
    if (newStatus) setStatus(newStatus);
    return newId;
  };

  const handleSave = async (newStatus?: string) => {
    setLoading(true);
    try {
      const id = await persist(newStatus);
      if (id) notify("Đã cập nhật dữ liệu!");
    } catch (e) {
      notify("Lỗi kết nối", "error");
    } finally {
      setLoading(false);
    }
  };

  const executeApproveAction = async (action: "APPROVE" | "REJECT") => {
    setLoading(true);
    try {
      // Lưu các chỉnh sửa của quản lý trước, rồi mới duyệt/trả lại
      const id = await persist();
      if (!id) return;

      const res: any = await taskApi.approveTask(id, action);
      if (res.data?.code === 200) {
        notify(action === "APPROVE" ? "Phê duyệt thành công!" : "Đã trả lại hồ sơ!");
        // Cập nhật trạng thái tại chỗ thay vì reload toàn bộ trang
        setStatus(res.data.data || (action === "APPROVE" ? "APPROVED" : "REJECTED"));
      } else {
        notify(res.data?.message || "Thao tác thất bại", "error");
      }
    } catch (e) {
      notify("Lỗi hệ thống", "error");
    } finally {
      setLoading(false);
    }
  };

  const openConfirm = (
    type: "primary" | "danger" | "warning",
    title: string,
    message: string,
    action: () => void,
  ) => setConfirmModal((p) => ({ ...p, isOpen: true, type, title, message, action }));

  // ---------------------------------------------------------------- CẬP NHẬT STATE
  // Dùng functional update + cập nhật bất biến => các callback ổn định, TaskRow memo hoạt động
  const updateSectionName = useCallback((sIdx: number, value: string) => {
    setTaskSections((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, sectionName: value } : s)),
    );
  }, []);

  const updateTask = useCallback<UpdateTaskFn>((sIdx, tIdx, field, value) => {
    const finalValue = PERCENT_FIELDS.has(field) ? normalizePercent(value) : value;
    setTaskSections((prev) =>
      prev.map((s, i) =>
        i !== sIdx
          ? s
          : {
              ...s,
              taskItems: s.taskItems.map((t, j) =>
                j === tIdx ? { ...t, [field]: finalValue } : t,
              ),
            },
      ),
    );
  }, []);

  const addTask = useCallback((sIdx: number) => {
    setTaskSections((prev) =>
      prev.map((s, i) =>
        i === sIdx ? { ...s, taskItems: [...s.taskItems, createEmptyTask()] } : s,
      ),
    );
  }, []);

  const removeTask = useCallback((sIdx: number, tIdx: number) => {
    setTaskSections((prev) =>
      prev
        .map((s, i) =>
          i === sIdx ? { ...s, taskItems: s.taskItems.filter((_, j) => j !== tIdx) } : s,
        )
        // Hạng mục không còn nhiệm vụ nào thì xóa luôn hạng mục
        .filter((s, i) => i !== sIdx || s.taskItems.length > 0),
    );
  }, []);

  const addSection = useCallback((category: Category) => {
    setTaskSections((prev) => [
      ...prev,
      { category, sectionName: "", taskItems: [createEmptyTask()] },
    ]);
  }, []);

  // Gom nhóm theo phần A/B/C 1 lần (trước đây filter + findIndex cho mỗi hạng mục mỗi lần render)
  const sectionsByCategory = useMemo(() => {
    const groups: Record<Category, { section: TaskSection; gIdx: number }[]> = {
      A: [],
      B: [],
      C: [],
    };
    taskSections.forEach((section, gIdx) => {
      groups[section.category]?.push({ section, gIdx });
    });
    return groups;
  }, [taskSections]);

  // ---------------------------------------------------------------- RENDER
  return (
    <div className="bg-white shadow-2xl rounded-xl border border-slate-200 overflow-hidden font-sans text-slate-900">
      {loading && (
        <div className="fixed inset-0 bg-white/40 z-[110] flex items-center justify-center backdrop-blur-[2px]">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      )}
      {showToast.show && (
        <div
          className={`fixed top-5 right-5 z-[120] flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-2xl animate-in slide-in-from-right-10 ${showToast.type === "success" ? "bg-green-600" : "bg-red-600"}`}
        >
          {showToast.msg}
        </div>
      )}

      <ConfirmModal
        {...confirmModal}
        onConfirm={() => {
          confirmModal.action?.();
          setConfirmModal((p) => ({ ...p, isOpen: false }));
        }}
        onCancel={() => setConfirmModal((p) => ({ ...p, isOpen: false }))}
      />

      <div className="bg-slate-50 border-b p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white">
            <User size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Hồ sơ của:</p>
            <p className="text-sm font-black text-blue-900 uppercase">
              {employeeName || "..."}
            </p>
          </div>
        </div>
        <span
          className={`text-xs font-bold px-3 py-1 rounded-full border ${status === "APPROVED" ? "bg-green-100 text-green-700 border-green-200" : "bg-orange-100 text-orange-700 border-orange-200"}`}
        >
          {status}
        </span>
      </div>

      <div className="p-4 bg-white border-b flex justify-between items-center">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border-2 border-slate-100 p-2 rounded-lg font-bold text-blue-700 outline-none"
        />
        <div className="flex gap-2">
          {canEditGeneral && (
            <button
              onClick={() => handleSave()}
              disabled={loading}
              className="bg-white border px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-50 disabled:opacity-50"
            >
              <Save size={16} /> {status === "APPROVED" ? "CẬP NHẬT" : "LƯU"}
            </button>
          )}
          {status !== "APPROVED" && !isApproverMode && (
            <button
              onClick={() =>
                openConfirm("primary", "Gửi phê duyệt", "Bạn muốn gửi hồ sơ này?", () =>
                  handleSave("PENDING_MANAGER"),
                )
              }
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={16} /> GỬI TRÌNH DUYỆT
            </button>
          )}
          {isApproverMode && status !== "APPROVED" && (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  openConfirm("danger", "Trả lại", "Yêu cầu sửa lại?", () =>
                    executeApproveAction("REJECT"),
                  )
                }
                disabled={loading}
                className="bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                TRẢ LẠI
              </button>
              <button
                onClick={() =>
                  openConfirm("primary", "Phê duyệt", "Xác nhận nội dung này?", () =>
                    executeApproveAction("APPROVE"),
                  )
                }
                disabled={loading}
                className="bg-green-600 text-white px-6 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                PHÊ DUYỆT
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 overflow-x-auto max-h-[calc(100vh-250px)] sticky bottom-0">
        <table className="w-[1800px] border-collapse text-[11px] border border-slate-200">
          <thead>
            <tr className="bg-[#2F5597] text-white uppercase">
              <th rowSpan={2} className="border p-3 w-12">STT</th>
              <th rowSpan={2} className="border p-3 w-56">Hạng mục</th>
              <th rowSpan={2} className="border p-3 w-80">Nhiệm vụ</th>
              <th rowSpan={2} className="border p-3 w-80 bg-[#3a5ba0]">Kết quả cần đạt</th>
              <th colSpan={2} className="border p-2">Thời gian</th>
              <th colSpan={2} className="border p-2">Mục tiêu</th>
              <th colSpan={2} className="border p-2">Kết quả</th>
              <th colSpan={2} className="border p-2 bg-[#1F3864]">Ưu tiên</th>
              <th colSpan={2} className="border p-2 bg-[#375623]">Phức tạp</th>
              <th className="border p-2 bg-[orange]">Ghi chú / Lưu ý</th>
              <th rowSpan={2} className="p-3 w-12 text-center">#</th>
            </tr>
            <tr className="bg-[#D9E1F2] text-slate-700 font-bold uppercase border-b border-slate-300">
              <th className="border p-2">Bắt đầu</th>
              <th className="border p-2">Kết thúc</th>
              {[0, 1, 2, 3].map((i) => (
                <React.Fragment key={i}>
                  <th className="border p-2 text-blue-700">CN</th>
                  <th className="border p-2 text-orange-700 bg-orange-50">QL</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map(({ key: cat, label }) => (
              <React.Fragment key={cat}>
                <tr className="bg-slate-100 font-black text-[#1F3864] border-y border-slate-300">
                  <td colSpan={16} className="p-3 uppercase italic">
                    Phần {cat}. {label}
                  </td>
                </tr>
                {sectionsByCategory[cat].map(({ section, gIdx }, sIdx) =>
                  section.taskItems.map((task, tIdx) => (
                    <TaskRow
                      key={`${gIdx}-${tIdx}`}
                      task={task}
                      sIdx={gIdx}
                      tIdx={tIdx}
                      sectionNumber={sIdx + 1}
                      sectionName={section.sectionName}
                      rowSpan={section.taskItems.length}
                      canEditGeneral={canEditGeneral}
                      canEditResults={canEditResults}
                      deleteMode={deleteMode}
                      onUpdateTask={updateTask}
                      onUpdateSectionName={updateSectionName}
                      onAddTask={addTask}
                      onRemoveTask={removeTask}
                    />
                  )),
                )}
                {canEditGeneral && (
                  <tr>
                    <td colSpan={16} className="p-3 border-b bg-white">
                      <button
                        onClick={() => addSection(cat)}
                        className="text-blue-600 font-bold flex items-center gap-2 text-xs uppercase"
                      >
                        <Plus size={18} /> Thêm hạng mục {cat}
                      </button>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            <tr className="bg-slate-900 text-white font-bold text-sm shadow-inner">
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
