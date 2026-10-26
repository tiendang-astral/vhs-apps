import { rootApi } from '../api/rootApi';

export const authenApi = {
  login: (data: any) =>

    rootApi.post('/Users/login', data),



  getById: (id: string) =>

    rootApi.get(`/Users/${id}`),

  register: (data: any) => rootApi.post('/Users/register', data),
  
deleteUser: (id: string) => rootApi.delete(`/Users/${id}`),


  changePassword: (data: { userId: string, oldPassword: string, newPassword: string }) =>

    rootApi.post('/Users/auth/change-password', data),

    getAllUsers: () => rootApi.get('/Users/all'),
    
    
    updateInfo: (data: any) => rootApi.put('/Users/update-info', data),
    
    uploadContract: (file: File, userId: string, type: string) => {
        const formData = new FormData();
        formData.append('file', file);
        return rootApi.post(`/Users/upload-contract?userId=${userId}&type=${type}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
downloadContract: (filePath: string) => {
    return rootApi.get(`/Users/download-contract`, {
        params: { 
            filePath: filePath,
            v: new Date().getTime() // Thêm trực tiếp tham số v vào đây
        },
        responseType: 'blob'
    });
},
uploadAvatar: (file: File, userId: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return rootApi.post(`/Users/upload-avatar/${userId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
},
};