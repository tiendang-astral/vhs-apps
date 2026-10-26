import { rootApi } from '../api/rootApi';

export const customerApi = {
    getAll: () => rootApi.get('/Customers'),
    create: (data: any) => rootApi.post('/Customers', data),
    update: (id: string, data: any) => rootApi.put(`/Customers/${id}`, data),
    delete: (id: string) => rootApi.delete(`/Customers/${id}`),
};