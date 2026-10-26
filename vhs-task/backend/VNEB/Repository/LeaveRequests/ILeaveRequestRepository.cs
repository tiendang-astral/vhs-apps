using VNEB.Models;
using VNEB.Responses;

namespace VNEB.Repository.LeaveRequests
{
    public interface ILeaveRequestRepository
    {
        Task<Response> Create(LeaveRequest request);
        Task<Response> GetForApprover();
        Task<Response> GetByUser();
        // Thêm deptId để lọc theo phòng ban
        Task<Response> GetStatisticalForHR(string? companyFilter, int? deptId);
        Task<Response> Approve(int requestId, string approverRole);
        Task<Response> Delete(int id);
        Task<Response> UpdateLeaveQuota(UserLeaveQuota quota);

        Task<Response> GetUserLeaveQuotaReport(string? companyFilter, int? deptId);
        Task<Response> Reject(int requestId, string reason);
    }
}