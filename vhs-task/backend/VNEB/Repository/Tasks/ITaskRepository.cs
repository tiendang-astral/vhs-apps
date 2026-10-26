using VNEB.DTO.TaskDTO;
using VNEB.Responses;

namespace VNEB.Repository.Tasks
{
    public interface ITaskRepository
    {
        // Quản lý Task cá nhân
        Task<Response> GetTasksAsync(string userId, string month);
        Task<Response> SaveTasksAsync(SaveTaskRegistrationDTO dto);
        Task<Response> SaveTasksAsync(SaveTaskRegistrationDTO dto, string? currentUserId, string? currentUserRole);

        // Quản lý Duyệt (Approvals)
        Task<Response> GetSubordinatesTasksAsync(string bossId, string month);
        Task<Response> ApproveOrRejectTaskAsync(string registrationId, string action, string bossRole);

        Task<Response> GetPerformanceStatsAsync(string? userId, int? deptId, DateTime fromDate, DateTime toDate);
    }
}