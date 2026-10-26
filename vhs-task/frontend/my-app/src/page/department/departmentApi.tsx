import { rootApi } from '../api/rootApi';

export const departmentApi = {
getDepartments: () => rootApi.get('/Departments'),
};