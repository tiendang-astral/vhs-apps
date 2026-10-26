import { rootApi } from '../api/rootApi'; // Đường dẫn đến file chứa cấu hình axios của bạn

export const specificationApi = {
  getAll: () => rootApi.get('/Specifications'),
  getById: (id: string) => rootApi.get(`/Specifications/${id}`),
  create: (data: any) => rootApi.post('/Specifications', data),
  update: (id: string, data: any) => rootApi.put(`/Specifications/${id}`, data),
  delete: (id: string) => rootApi.delete(`/Specifications/${id}`),
};