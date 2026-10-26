import { rootApi } from '../api/rootApi';

export const electricApi = {
    // Lấy danh sách toàn bộ
    getAllUsage: () => rootApi.get('/Electrics'),

    // PHẦN THÊM MỚI: Lấy theo tháng năm (Giống logic MonthlyTask)
    getByMonth: (year: number, month: number) => 
        rootApi.get(`/Electrics/by-month?year=${year}&month=${month}`),

    // Tạo mới
    createUsage: (data: any) => {
        const payload = mapToBackend(data);
        return rootApi.post('/Electrics', payload);
    },

    // Cập nhật
    updateUsage: (id: string, data: any) => {
        const payload = mapToBackend(data);
        return rootApi.put(`/Electrics/${id}`, payload);
    },

    // Xóa
    deleteUsage: (id: string) => rootApi.delete(`/Electrics/${id}`),
};

// Hàm mapToBackend giữ nguyên như cũ của bạn
const mapToBackend = (data: any) => ({
    id: data.id,
    customerId: data.customerId, // Dùng đúng tên field logic cũ
    year: data.year,
    month: data.month,
    price_FlatRate: data.price_FlatRate,
    price_Normal: data.price_Normal,
    price_Peak: data.price_Peak,
    price_OffPeak: data.price_OffPeak,
    p_FlatRate: data.p_FlatRate,
    p_Normal: data.p_Normal,
    p_Peak: data.p_Peak,
    p_OffPeak: data.p_OffPeak,
});