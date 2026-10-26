import { rootApi } from '../api/rootApi';

export const leaveApi = {
  create: (data: any) => rootApi.post('/LeaveRequests/create', data),
  getByUser: () => rootApi.get(`/LeaveRequests/my-requests`), // Sạch sẽ
  getApprovals: () => rootApi.get(`/LeaveRequests/get-approvals`),
getStatistical: (company?: string, deptId?: number) => 
    rootApi.get(`/LeaveRequests/statistical`, { 
        params: { 
            company: company,
            deptId: deptId 
        } 
    }),
  delete: (id: number) => rootApi.delete(`/LeaveRequests/${id}`),
  approveAction: (requestId: number, approverRole: string) => 
  rootApi.post(`/LeaveRequests/approve?requestId=${requestId}&approverRole=${approverRole}`),

  getQuotaReport: (company?: string, deptId?: number) => 
    rootApi.get(`/LeaveRequests/quota-report`, { 
        params: { company, deptId } 
    }),

  updateQuota: (data: any) => rootApi.post('/LeaveRequests/update-quota', data),

  rejectAction: (requestId: number, reason: string) => 
    rootApi.post(`/LeaveRequests/reject/${requestId}`, reason, {
        headers: { 'Content-Type': 'application/json' }
    }),
};