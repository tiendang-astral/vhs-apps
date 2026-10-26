import { rootApi } from '../api/rootApi';

export const dashboardApi = {
  // Cập nhật hàm này để nhận thêm deptId
  getPersonalStats: (userId: string | null, fromDate: string, toDate: string, deptId?: string) => 
    rootApi.get(`/Task/performance/personal`, { 
      params: { 
        userId: userId || "",
        fromDate, 
        toDate, 
        deptId: deptId || ""
      }
    }),

  getUsersByDept: async (deptId: string) => {
    const response = await rootApi.get(`/Users/department/${deptId}`); 
    return response.data;
  },
};