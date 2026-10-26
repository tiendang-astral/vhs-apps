import { rootApi } from '../api/rootApi';

export const taskApi = {
  // 1. Lấy chi tiết nhiệm vụ của 1 nhân viên (Dùng cho cả nhân viên tự xem và sếp xem)
  getByUserAndMonth: (userId: string, month: string) =>
    rootApi.get(`/Task/${encodeURIComponent(userId)}/${encodeURIComponent(month)}`),

  // 2. Nhân viên lưu hoặc gửi duyệt
  saveTasks: (data: any) => 
    rootApi.post('/Task/save', data),

  // 3. Lấy danh sách cấp dưới chờ duyệt (Dành cho màn hình List của sếp)
  getApprovals: (bossId: string, month: string) =>
    rootApi.get(`/Task/approvals/${encodeURIComponent(bossId)}`, { params: { month } }),

  // 4. Sếp thực hiện Duyệt hoặc Trả lại
  // Khớp với Endpoint [HttpPost("approve-action")] ở Backend
approveTask: (registrationId: string, action: 'APPROVE' | 'REJECT') => 
    rootApi.post('/Task/approve-action', { registrationId, action }),
};